import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');

// In-memory token cache (NEVER stored in localStorage per guidelines)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogle = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google access token');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getCachedAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

export interface UploadedDriveFile {
  id: string;
  name: string;
  webViewLink: string;
  webContentLink?: string;
  size?: string;
}

export interface DriveProjectUploadResult {
  folderId: string;
  folderName: string;
  folderUrl: string;
  files: UploadedDriveFile[];
}

/**
 * Creates a folder in Google Drive
 */
export const createDriveFolder = async (
  folderName: string
): Promise<{ id: string; name: string; webViewLink: string }> => {
  if (!cachedAccessToken) {
    throw new Error('User is not authenticated with Google Drive');
  }

  const response = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cachedAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'مجلد مشروع احسبلى (E7sbly) - حزمة الـ APK والسورس كود الكامل',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Folder creation failed: ${errText}`);
  }

  return await response.json();
};

/**
 * Uploads a single Blob to Google Drive, optionally inside a specific parent folder
 */
export const uploadBlobToDrive = async (
  blob: Blob,
  fileName: string,
  mimeType: string,
  folderId?: string,
  description?: string
): Promise<UploadedDriveFile> => {
  if (!cachedAccessToken) {
    throw new Error('User is not authenticated with Google Drive');
  }

  const metadata: Record<string, any> = {
    name: fileName,
    mimeType: mimeType,
    description: description || '',
  };

  if (folderId) {
    metadata.parents = [folderId];
  }

  const boundary = '-------ehsably_upload_' + Date.now();
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart = new Blob([
    delimiter,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    JSON.stringify(metadata),
    delimiter,
    `Content-Type: ${mimeType}\r\n\r\n`,
  ], { type: 'text/plain' });

  const multipartBody = new Blob([
    metadataPart,
    blob,
    new Blob([closeDelimiter], { type: 'text/plain' }),
  ]);

  const uploadResponse = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cachedAccessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Upload failed for ${fileName}: ${errorText}`);
  }

  return await uploadResponse.json();
};

/**
 * Uploads a single APK directly (backward compatibility)
 */
export const uploadApkToGoogleDrive = async (
  onProgress?: (msg: string) => void
): Promise<UploadedDriveFile> => {
  onProgress?.('جارٍ جلب ملف الـ APK من السيرفر...');
  const apkResponse = await fetch('/ehsably-release.apk');
  if (!apkResponse.ok) {
    throw new Error(`Failed to fetch APK: HTTP ${apkResponse.status}`);
  }
  const apkBlob = await apkResponse.blob();

  onProgress?.('جارٍ رفع ملف الـ APK إلى Google Drive...');
  return await uploadBlobToDrive(
    apkBlob,
    'E7sbly-release.apk',
    'application/vnd.android.package-archive',
    undefined,
    'تطبيق احسبلى (E7sbly) للأندرويد - قارن الأوفر ووفر فلوسك'
  );
};

/**
 * Uploads the FULL project (Folder + Release APK + Debug APK + Source Code ZIP + Documentation)
 */
export const uploadFullProjectToFolder = async (
  onProgress?: (step: number, total: number, message: string) => void
): Promise<DriveProjectUploadResult> => {
  const totalSteps = 5;

  // 1. Create Project Folder
  onProgress?.(1, totalSteps, 'جارٍ إنشاء مجلد "E7sbly - احسبلي" في Google Drive...');
  const folder = await createDriveFolder('E7sbly - احسبلي');
  const folderId = folder.id;
  const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;

  const uploadedFiles: UploadedDriveFile[] = [];

  // 2. Upload Signed Release APK
  onProgress?.(2, totalSteps, 'جارٍ رفع نسخة الإنتاج الرسمية E7sbly-release.apk (1.8 MB)...');
  try {
    const releaseResp = await fetch('/E7sbly-release.apk');
    if (releaseResp.ok) {
      const releaseBlob = await releaseResp.blob();
      const fileData = await uploadBlobToDrive(
        releaseBlob,
        'E7sbly-release.apk',
        'application/vnd.android.package-archive',
        folderId,
        'تطبيق احسبلى الرسمي الموقّع للأندرويد 10+ (جاهز للتثبيت والتجربة فوراً)'
      );
      uploadedFiles.push({ ...fileData, size: '1.8 MB' });
    }
  } catch (err) {
    console.warn('Failed to upload release APK:', err);
  }

  // 3. Upload Debug APK
  onProgress?.(3, totalSteps, 'جارٍ رفع نسخة الاختبار E7sbly-debug.apk (1.8 MB)...');
  try {
    const debugResp = await fetch('/E7sbly-debug.apk');
    if (debugResp.ok) {
      const debugBlob = await debugResp.blob();
      const fileData = await uploadBlobToDrive(
        debugBlob,
        'E7sbly-debug.apk',
        'application/vnd.android.package-archive',
        folderId,
        'نسخة الاختبار والمطورين (Debug APK)'
      );
      uploadedFiles.push({ ...fileData, size: '1.8 MB' });
    }
  } catch (err) {
    console.warn('Failed to upload debug APK:', err);
  }

  // 4. Upload Source Code Archive
  onProgress?.(4, totalSteps, 'جارٍ رفع سورس كود المشروع الكامل E7sbly-Source-Code.zip (16 MB)...');
  try {
    const zipResp = await fetch('/E7sbly-Source-Code.zip');
    if (zipResp.ok) {
      const zipBlob = await zipResp.blob();
      const fileData = await uploadBlobToDrive(
        zipBlob,
        'E7sbly-Source-Code.zip',
        'application/zip',
        folderId,
        'السورس كود الكامل لمشروع احسبلى (React 19 + Android Studio Native Container)'
      );
      uploadedFiles.push({ ...fileData, size: '16 MB' });
    }
  } catch (err) {
    console.warn('Failed to upload source code zip:', err);
  }

  // 5. Upload Documentation
  onProgress?.(5, totalSteps, 'جارٍ رفع ملف الشرح والتعليمات README_E7SBLY.txt...');
  try {
    const docResp = await fetch('/README_E7SBLY.txt');
    if (docResp.ok) {
      const docBlob = await docResp.blob();
      const fileData = await uploadBlobToDrive(
        docBlob,
        'README_E7SBLY.txt',
        'text/plain',
        folderId,
        'شرح محتويات المشروع وخطوات التثبيت على الهاتف'
      );
      uploadedFiles.push({ ...fileData, size: '2 KB' });
    }
  } catch (err) {
    console.warn('Failed to upload documentation:', err);
  }

  return {
    folderId,
    folderName: 'E7sbly - احسبلي',
    folderUrl,
    files: uploadedFiles,
  };
};
