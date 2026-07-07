import { useEffect } from "react";
import { PermissionsAndroid, Platform } from "react-native";

export function useAppPermissions() {
  useEffect(() => {
    async function requestPermissions() {
      if (Platform.OS === "android") {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
        ];

        if (Number(Platform.Version) >= 33) {
          permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        }

        try {
          await PermissionsAndroid.requestMultiple(permissions);
        } catch (err) {
          console.warn("Failed to request permissions:", err);
        }
      }
    }
    requestPermissions();
  }, []);
}
