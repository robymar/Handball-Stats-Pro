# Migration to Firebase: Summary and Next Steps

## Completed Actions
1. **Removed Supabase Dependencies**: Uninstalled `@supabase/supabase-js`, deleted `services/supabase.ts` and related check scripts.
2. **Integrated Firebase**: Added `firebase` package, created `services/firebase.ts` with initialization logic.
3. **Authentication**:
   - Replaced Supabase Auth with **Firebase Authentication** (Email/Password).
   - Updated `LoginView.tsx` to handle registration, login, email verification, and password reset.
   - **New Feature**: Added `ResetPasswordView.tsx` to handle password reset flow within the app via deep links.
   - Updated `App.tsx` Deep Link Listener to process `verifyEmail` and `resetPassword` action codes.
4. **Data Storage (Firestore)**:
   - Migrated all data storage logic in `services/storageService.ts` to use **Cloud Firestore**.
   - Data is now scoped under `users/{uid}/teams` and `users/{uid}/matches`.
   - Updated `CloudMatchList.tsx` and `PublicMatchViewer.tsx` to read from Firestore.
   - Added support for **public match viewing** via Collection Group queries.
5. **Security**:
   - Created `firestore.rules` file with security rules for user data isolation and public match read access.
6. **Configuration**:
   - Updated `.env` with Firebase configuration keys.
   - Installed `@capacitor/toast` for improved user feedback.

## Next Steps for You

### 1. Firebase Console Setup
- Go to the [Firebase Console](https://console.firebase.google.com/).
- Select your project.
- **Authentication**: 
  - Go to **Authentication** > **Sign-in method**.
  - Enable **Email/Password**.
  - (Optional) Configure **Email Templates** for Verification and Password Reset.
- **Firestore Database**:
  - Go to **Firestore Database**.
  - Ensure the database is created (in production mode).
  - Go to the **Rules** tab and paste the contents of `firestore.rules` (or deploy via CLI).

### 2. Update Android configuration
- Your `google-services.json` file should be placed in `android/app/` if not already there.
- Verify `package.name` in `AndroidManifest.xml` matches your Firebase project settings exactly.

### 3. Deploy Firestore Rules
If you have Firebase CLI installed:
```bash
firebase deploy --only firestore:rules
```
Or copy the content of `firestore.rules` to the Firebase Console manually.

### 4. Build and Test
- Run `npm run dev` to test locally.
- Run `npx cap sync` to update the Android project.
- Run `npx cap open android` to test on device/emulator.

## Important Notes
- **Email Verification**: User registration now sends a verification email. Until verified, users cannot fully access cloud features (enforced in `LoginView`).
- **Deep Links**: Ensure your Android `intent-filter` handles the link domain configured in Firebase (e.g., `handballstats://auth` or your custom domain).
