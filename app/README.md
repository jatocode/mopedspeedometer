# Nästa steg på Mac

cd app
npx expo prebuild --platform ios
cd ios && pod install
npx expo run:ios

# Building & distributing to family members
The easiest path for an Expo project with a small group is TestFlight via EAS Build — it doesn't require owning a Mac.

## What you need first
Apple Developer account — $99/year at developer.apple.com
Expo account — free at expo.dev (for EAS Build)
### Step 1 — Set up EAS
> npm install -g eas-cli
> eas login
> cd app
> eas build:configure   # creates eas.json
### Step 2 — Build in the cloud (no Mac needed)

> eas build --platform ios --profile production

EAS runs the build on Apple silicon servers. It will prompt you to log in to your Apple Developer account the first time and handle provisioning profiles automatically. The build takes ~10–15 minutes.

### Step 3 — Submit to TestFlight

> eas submit --platform ios

This uploads the .ipa directly to App Store Connect / TestFlight.

### Step 4 — Invite family members in App Store Connect

Go to https://appstoreconnect.apple.com
Open your app → TestFlight tab
Add testers under Internal Testing (up to 100 people) using their Apple ID email
They get an email invite → install TestFlight from the App Store → tap the link
They'll receive update notifications automatically whenever you push a new build.