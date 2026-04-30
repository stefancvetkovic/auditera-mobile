const fs = require('fs');

const gradlePath = 'android/app/build.gradle';
let gradle = fs.readFileSync(gradlePath, 'utf8');

const storePassword = process.env.ANDROID_KEYSTORE_PASSWORD;
const keyAlias = process.env.ANDROID_KEY_ALIAS;
const keyPassword = process.env.ANDROID_KEY_PASSWORD;

const releaseConfig = `
        release {
            storeFile file('auditera-upload.jks')
            storePassword '${storePassword}'
            keyAlias '${keyAlias}'
            keyPassword '${keyPassword}'
        }`;

gradle = gradle.replace(
  /signingConfigs\s*\{/,
  'signingConfigs {' + releaseConfig
);

gradle = gradle.replace(
  /signingConfig signingConfigs\.debug/g,
  'signingConfig signingConfigs.release'
);

fs.writeFileSync(gradlePath, gradle);
console.log('Signing config patched successfully');
