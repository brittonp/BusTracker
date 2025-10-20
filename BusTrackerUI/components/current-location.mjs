import { appConstant } from "@components/globals.mjs";
import { appUtils } from "@components/utils.mjs";

export let currentLocation = {
  get: async function () {
    try {
      //throw new Error("Test Error");
      const position = await getGeoLocation();
      currentLocation = {
        ...currentLocation,
        position: position,
        //center: { lat: 51.418251, lng: -0.30153999 },
        center: {
          lat: position.latitude,
          lng: position.longitude,
        },
        canTrack: !(position.code == 1),
      };
      return position;
    } catch (err) {
      appUtils.log(err.message);
      currentLocation = {
        ...currentLocation,
        canTrack: false,
      };
      return err;
    }
    function getGeoLocation() {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve(position.coords),
          (error) => reject(error)
        );
      });
    }
  },
  set: async function () {
    await this.get();
    if (!this.canTrack) return false;

    $(document).trigger("show-location", this);
    setTimeout(
      this.set.bind(this),
      appConstant.refreshCurrentLocationSecs * 1000
    );
  },
};
