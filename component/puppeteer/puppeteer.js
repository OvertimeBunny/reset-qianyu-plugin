import template from 'art-template'
import fs from 'fs'
import lodash from 'lodash'
import { segment } from '../icqq/index.js'
import chokidar from 'chokidar'
import Config from '../../model/base/Config.js'
import path from 'path'
const _path = process.cwd()
let cfg = Config.GetCfg("system/puppeteer")
let qianyuPath = _path
let puppeteer = {}

class Puppeteer {
  constructor() {
    this.browser = false
    this.lock = false
    this.shoting = []
    this.restartNum = 100
    this.renderNum = 0
    this.config = {
      headless: true,
      args: [
        '--disable-gpu',
        '--disable-setuid-sandbox',
        '--no-sandbox',
        '--no-zygote',
        '--single-process',
        '--disable-dev-shm-usage'
      ]
    }

    if (cfg?.chromiumPath) {
      this.config.executablePath = cfg.chromiumPath
    }

    this.html = {}
    this.watcher = {}
    this.createDir(qianyuPath + '/data/html')
  }

  async initPupp() {
    if (!lodash.isEmpty(puppeteer)) return puppeteer
    puppeteer = (await import('puppeteer')).default
    return puppeteer
  }

  getversion() {
    let version = JSON.parse(fs.readFileSync('./node_modules/puppeteer/package.json')).version
    let v = version.split('.')
    return v[0]
  }

  createDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir)
    }
  }

  async browserInit() {
    await this.initPupp()
    if (this.browser) return this.browser
    if (this.lock) return false
    this.lock = true
    if (this.getversion() >= 20) {
      this.config.headless = 'new'
    }

    logger.mark('puppeteer Chromium 启动中...')

    this.browser = await puppeteer.launch(this.config).catch((err) => {
      logger.error(err.toString())
      if (String(err).includes('correct Chromium')) {
        logger.error('没有正确安装Chromium，可以尝试执行安装命令：node ./node_modules/puppeteer/install.js')
      }
    })

    this.lock = false

    if (!this.browser) {
      logger.error('puppeteer Chromium 启动失败')
      return false
    }

    logger.mark('puppeteer Chromium 启动成功')

    this.browser.on('disconnected', (e) => {
      logger.error('Chromium实例关闭或崩溃！')
      this.browser = false
    })

    return this.browser
  }

  async screenshot(name, data = {}) {
    if (!await this.browserInit()) {
      return false
    }

    let savePath = this.dealTpl(name, data)
    if (!savePath) return false

    let buff = ''
    let start = Date.now()

    this.shoting.push(name)

    try {
      const page = await this.browser.newPage()
      await page.goto(`file://${savePath}`, data.pageGotoParams || {})
      let body = await page.$('#container') || await page.$('body')

      let randData = {
        type: data.imgType || 'jpeg',
        omitBackground: data.omitBackground || false,
        quality: data.quality || 100,
        path: data.path || ''
      }

      if (data.imgType == 'png') delete randData.quality

      buff = await body.screenshot(randData)

      page.close().catch((err) => logger.error(err))
    } catch (error) {
      logger.error(`图片生成失败:${name}:${error}`)
      if (this.browser) {
        await this.browser.close().catch((err) => logger.error(err))
      }
      this.browser = false
      buff = ''
      return false
    }

    this.shoting.pop()

    if (!buff) {
      logger.error(`图片生成为空:${name}`)
      return false
    }

    this.renderNum++

    let kb = (buff.length / 1024).toFixed(2) + 'kb'
    logger.mark(`[图片生成][${name}][${this.renderNum}次] ${kb} ${logger.green(`${Date.now() - start}ms`)}`)

    this.restart()

    return segment.image(buff)
  }

  async urlScreenshot(url, path) {
    if (!await this.browserInit()) {
      return false
    }
    let buff = ''
    let start = Date.now()
    try {
      const page = await this.browser.newPage()
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      let randData = {
        type: 'jpeg',
        quality: 100,
        fullPage: true,
        path: path || ''
      }

      buff = await page.screenshot(randData)

      page.close().catch((err) => logger.error(err))
    } catch (error) {
      logger.error(`图片生成失败:${error}`)
      if (this.browser) {
        await this.browser.close().catch((err) => logger.error(err))
      }
      this.browser = false
      buff = ''
      return false
    }

    if (!buff) {
      logger.error(`图片生成为空:${name}`)
      return false
    }

    this.renderNum++

    let kb = (buff.length / 1024).toFixed(2) + 'kb'
    logger.mark(`[图片生成][${this.renderNum}次] ${kb} ${logger.green(`${Date.now() - start}ms`)}`)

    this.restart()

    return segment.image(buff)
  }

  dealTpl(name, data) {
    let { tplFile, saveId = name } = data
    let savePath = qianyuPath + path.join(`/data/html/${name}/${saveId}.html`)
    if (!this.html[tplFile]) {
      this.createDir(qianyuPath + `/data/html/${name}`)
      tplFile = qianyuPath + path.join(`/${tplFile}`)
      try {
        this.html[tplFile] = fs.readFileSync(tplFile, 'utf8')
      } catch (error) {
        logger.error(`加载html错误：${tplFile}`)
        return false
      }
      this.watch(tplFile)
    }

    data.resPath = `${_path}/resources/`

    let tmpHtml = template.render(this.html[tplFile], data)

    fs.writeFileSync(savePath, tmpHtml)
    logger.debug(`[图片生成][使用模板] ${savePath}`)

    return savePath
  }

  watch(tplFile) {
    if (this.watcher[tplFile]) return
    const watcher = chokidar.watch(tplFile)
    watcher.on('change', path => {
      delete this.html[tplFile]
      logger.mark(`[修改html模板] ${tplFile}`)
    })
    this.watcher[tplFile] = watcher
  }

  restart() {
    if (this.renderNum % this.restartNum == 0) {
      if (this.shoting.length <= 0) {
        setTimeout(async () => {
          if (this.browser) {
            await this.browser.close().catch((err) => logger.error(err))
          }
          this.browser = false
          logger.mark('puppeteer 关闭重启...')
        }, 100)
      }
    }
  }
}

export default new Puppeteer()
