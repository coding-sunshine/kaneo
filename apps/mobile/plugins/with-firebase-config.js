/**
 * Android chat pushes need the app's Firebase config (google-services.json), which belongs to
 * the Firebase project of whoever builds the app and is never committed. Point
 * `KANEO_GOOGLE_SERVICES_FILE` at it for a build with pushes; without it the app builds as before
 * and says on the Account screen that this phone gets no push token.
 */
module.exports = function withFirebaseConfig(config) {
  const file = process.env.KANEO_GOOGLE_SERVICES_FILE;
  if (!file) return config;
  return {
    ...config,
    android: { ...config.android, googleServicesFile: file },
  };
};
