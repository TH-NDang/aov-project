// Starts the home banner of the reader's day while the app still loads; the page lists the banners in data-banners.
// A file rather than an inline script, so that the content security policy can refuse every inline script. It repeats
// `bannerOfDay` in src/lib/home-banners.ts; a test keeps the two choosing the same banner.
;(function () {
  var script = document.currentScript
  var urls = script ? JSON.parse(script.dataset.banners || "[]") : []
  if (!urls.length) return
  var now = new Date()
  var day = Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000)
  var link = document.createElement("link")
  link.rel = "preload"
  link.as = "image"
  link.href = urls[day % urls.length]
  link.setAttribute("fetchpriority", "high")
  document.head.appendChild(link)
})()
