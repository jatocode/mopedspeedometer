# Nästa steg på Mac

cd app
npx expo prebuild --platform ios
cd ios && pod install
npx expo run:ios