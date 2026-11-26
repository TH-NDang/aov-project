const element = (tag) => ({
  tag,
  attributes: {},
  focused: 0,
  setAttribute(name, value) {
    this.attributes[name] = value
  },
  focus() {
    this.focused += 1
  },
  remove() {
    this.removed = true
  },
})

/** A host that holds elements, and lets YouTube put its frame in the place of the one it was given. */
function hostElement() {
  const host = {
    children: [],
    replaceChildren(...nodes) {
      for (const node of nodes) node.replaceWith = (other) => (host.children = [other])
      host.children = nodes
    },
  }
  return host
}

/** A player of YouTube's API as it stands in the page: it says what it was told, and answers what the test sets. */
function playerClass(players) {
  return class Player {
    log = []
    state = -1
    second = 0
    quiet = false
    speed = 1

    constructor(mount, options) {
      this.options = options
      this.events = options.events
      this.mount = mount
      this.frame = element("iframe")
      mount.replaceWith(this.frame)
      players.push(this)
    }
    /** The frame has come up. */
    ready(state = -1) {
      this.state = state
      this.events.onReady({ target: this })
    }
    says(state) {
      this.state = state
      this.events.onStateChange({ data: state, target: this })
    }
    fails(code) {
      this.events.onError({ data: code, target: this })
    }
    loadVideoById({ videoId, startSeconds }) {
      this.log.push(`load ${videoId}${startSeconds == null ? "" : ` from ${startSeconds}`}`)
    }
    seekTo(second) {
      this.log.push(`seek ${second}`)
    }
    playVideo() {
      this.log.push("play")
    }
    pauseVideo() {
      this.log.push("pause")
    }
    mute() {
      this.log.push("mute")
      this.quiet = true
    }
    unMute() {
      this.log.push("unmute")
      this.quiet = false
    }
    isMuted() {
      return this.quiet
    }
    getCurrentTime() {
      return this.second
    }
    getPlayerState() {
      return this.state
    }
    getPlaybackRate() {
      return this.speed
    }
    getIframe() {
      return this.frame
    }
    destroy() {
      this.log.push("destroy")
      this.frame.replaceWith = undefined
      this.mount.replaceWith(this.mount)
    }
  }
}

let visits = 0

/**
 * A page that has just been opened, with its own copy of the player's module, as YouTube's script is loaded once a
 * page. The script is answered by the test: it is refused, or it begins, which declares `YT`, and is finished by a
 * second one.
 */
export async function openPage() {
  const timers = new Map()
  const scripts = []
  const players = []
  let now = 0
  let made = 0
  const page = {
    location: { origin: "https://stream.test" },
    setTimeout(run, milliseconds) {
      made += 1
      timers.set(made, { at: now + milliseconds, run })
      return made
    },
    clearTimeout: (timer) => timers.delete(timer),
  }
  globalThis.window = page
  globalThis.document = { createElement: element, head: { append: (script) => scripts.push(script) } }
  const { openYouTube } = await import(`../../src/lib/youtube-player.ts?visit=${++visits}`)

  /** Lets what waits for an answer of the script go on. */
  const settle = () => new Promise((resolve) => setImmediate(resolve))
  return {
    page,
    scripts,
    players,
    settle,
    /** How many times the script has asked for its second one. */
    begun: 0,
    async refuse() {
      scripts.at(-1).onerror()
      await settle()
    },
    /** Runs the first script: a name it declares with `var` can be given another value and never be deleted. */
    begin() {
      if (!page.YT) {
        const fresh = { loading: 0, loaded: 0 }
        if (Object.hasOwn(page, "YT")) page.YT = fresh
        else Object.defineProperty(page, "YT", { value: fresh, writable: true, enumerable: true, configurable: false })
      }
      if (page.YT.loading) return
      page.YT.loading = 1
      this.begun += 1
    },
    /** Runs the second script, which brings the player. */
    async finish() {
      page.YT.Player = playerClass(players)
      page.onYouTubeIframeAPIReady?.()
      await settle()
    },
    async load() {
      this.begin()
      await this.finish()
    },
    /** Lets so many milliseconds pass. */
    pass(milliseconds) {
      now += milliseconds
      for (const [timer, { at, run }] of [...timers])
        if (at <= now) {
          timers.delete(timer)
          run()
        }
    },
    waiting: () => timers.size,
    /** Opens a video in a host of its own; `heard` is what the player says. */
    open(options = {}) {
      const host = hostElement()
      const heard = []
      const player = openYouTube(host, {
        videoId: "j8AvYygkzm4",
        second: 0,
        title: "Video: Saigon Phantom gặp BOOM Esports",
        onState: (state) => heard.push(state),
        onFailure: (failure) => heard.push(failure),
        onAutoplayBlocked: () => heard.push("AUTOPLAY BLOCKED"),
        ...options,
      })
      return { player, host, heard }
    },
    /** Opens a video whose player is ready. */
    async play(options) {
      const opened = this.open(options)
      await this.load()
      const own = players.at(-1)
      own.ready()
      opened.heard.length = 0
      return { ...opened, own }
    },
  }
}
