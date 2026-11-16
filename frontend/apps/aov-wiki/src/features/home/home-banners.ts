/** Hero artwork behind the home page's opening; `position` keeps the character in view when the band crops it. */
const HOME_BANNERS = [
  {
    image:
      "https://img.athahub.com/assets/6bd9e53a-97f0-49b1-a138-5d33bd2851c7/77f2495e-6bd4-446a-8fb8-beb226430adf.jpg",
    character: "Dirak",
    position: "65% 35%",
  },
  {
    image:
      "https://img.athahub.com/assets/9bd621ab-327d-400d-b655-fbe505981139/2ed02d7c-7a80-4bb5-92bb-9b2b6750d235.jpg",
    character: "Hayate",
    position: "65% 40%",
  },
  {
    image:
      "https://img.athahub.com/assets/2fef27ee-8557-4223-95ba-0ec6127b7f07/7f318a76-d2c7-4214-97eb-cbe259c22baf.jpg",
    character: "Yorn",
    position: "40% 28%",
  },
] as const

/** One picture a day, so the page looks fresh across visits without moving while it is read. */
export function bannerOfDay(now = new Date()) {
  const day = Math.floor((now.getTime() - now.getTimezoneOffset() * 60_000) / 86_400_000)
  return HOME_BANNERS[day % HOME_BANNERS.length]!
}
