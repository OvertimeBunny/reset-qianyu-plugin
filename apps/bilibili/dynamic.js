import lodash from 'lodash'
import moment from 'moment';

const dynamicType = {
    live: '直播',
    text: '文字',
    draw: '图文',
    av: '视频',
    forward: '转发',
    article: '专栏',
    raffle: '抽奖'
}

async function setUpPush(e) {
    let dtype = e.msg.match(/直播|文字|图文|视频|转发|抽奖|专栏/g)?.[0] || '全部'
    let mid = e.msg.replace(new RegExp(e.reg), "").trim()//纯数字
    if (!mid) {
        return e.reply("订阅不能为空，请输入用户id或者用户昵称！")
    }
    if (isNaN(mid)) {
        let data = await this.getSearchUser(mid)
        if (!data) {
            return e.reply("没有找到该用户呢！")
        }
        mid = data.mid
    }
    let reslut = await this.getUpdateDynamic(mid)
    let updata = this.getBilibiUpPushData(e.group_id) || {}
    if (reslut?.code && reslut.code != 0) {
        if (reslut.code == -352) {
            return e.reply("请先设置b站ck进行订阅！")
        }
        return e.reply(reslut.message || reslut.msg)
    }
    let data, type;
    type = Object.entries(dynamicType).find(item => item[1] == dtype)?.[0]

    data = {
        nickname: reslut?.author?.nickname,
        upuid: reslut?.id || 0,
        uid: mid,
        img: reslut?.author?.img,
        pendantImg: reslut?.author?.pendantImg,
        dynamicType: updata[mid]?.dynamicType ? [...updata[mid]?.dynamicType, type] : [type]
    }

    if (reslut?.code == 0) {
        let authorInfo = await this.getUserInfo(mid)
        data = {
            ...data,
            nickname: authorInfo.name,
            img: authorInfo.face,
            pendantImg: authorInfo.pendant?.image,
            dynamicType: updata[mid]?.dynamicType ? [...updata[mid]?.dynamicType, type] : [type]
        }
    }


    if (!type) {
        delete data.dynamicType
        type = 'all'
    }
    updata[mid] = data
    this.setBilibiUpPushData(e.group_id, updata)
    return e.reply([this.segment.image(data.img), `昵称：${data.nickname}\n`, type == 'all' ? `订阅Up主${data.nickname}成功！` : `已订阅Up主${data.nickname}的${dynamicType[type]}推送！`])
}

async function delUpPush(e) {
    let dtype = e.msg.match(/直播|文字|图文|视频|转发|抽奖|专栏/g)?.[0]
    let mid = e.msg.replace(new RegExp(e.reg), "")
    if (!mid) {
        return e.reply("请输入B站用户id或者用户昵称！")
    }
    if (isNaN(mid)) {
        let data = await this.getSearchUser(mid)
        if (!data) {
            return e.reply("没有找到该用户呢！")
        }
        mid = `${data.mid}`
    }
    let updata = this.getBilibiUpPushData(e.group_id)
    let uplist = Object.keys(updata)
    let result = updata[mid]
    let type = Object.entries(dynamicType).find(item => item[1] == dtype)?.[0] || 'all'
    if (!uplist.includes(mid)) {
        return e.reply("暂未订阅该up主！")
    } else if (type == 'all') {
        delete updata[mid]
    } else {
        updata[mid] = { ...updata[mid], unpush: updata[mid]?.unpush ? [...updata[mid]?.unpush, type] : [type] }
    }
    this.setBilibiUpPushData(e.group_id, updata)
    return e.reply(type == 'all' ? `取消订阅Up主${result.nickname}成功！` : `已取消Up主${result.nickname}的${dynamicType[type]}推送！`)
}

async function pushdynamic() {
    for (let g of this.getBilibiliGroupList()) {
        let updata = this.getBilibiUpPushData(g)
        if (Object.keys(updata).length == 0) continue
        for (let item of Object.values(updata)) {
            let data = await this.getUpdateDynamic(item.uid)
            if (item.dynamicType && !item.dynamicType.includes(Object.keys(dynamicType).find(i => dynamicType[i] === data.type))) continue
            if (item.unpush && item.unpush.includes(Object.keys(dynamicType).find(i => dynamicType[i] === data.type))) continue
            if (!data) continue
            if (data.code) continue
            if (data.id !== item.upuid) {
                let bglist = this.File.GetfileList('resources/html/bilibili/bg')
                let radom = bglist[lodash.random(0, bglist.length - 1)]
                await this.bot.pickGroup(g).sendMsg(await this.render('bilibili', { radom, ...data }))
                let imglist = [];
                if (data.imglist) {
                    imglist = data.imglist.map(item => {
                        return { content: this.segment.image(item) }
                    })
                }
                if (data.orig?.imglist) {
                    data.orig?.imglist.forEach(item => {
                        imglist.push({ content: this.segment.image(item) })
                    })
                }
                if (imglist.length > 0 && data.type != '专栏') {
                    await this.bot.pickGroup(g).sendMsg(await this.makeGroupMsg2('动态图片', imglist, true, g))
                }
                data = {
                    ...updata[item.uid],
                    nickname: data.author.nickname,
                    upuid: data.id,
                    uid: item.uid,
                    img: data.author.img,
                    pendantImg: data.author.pendantImg,
                }
                updata[item.uid] = data
                this.setBilibiUpPushData(g, updata)
            }
        }
    }
}

async function livepush() {
    for (let g of this.getBilibiliGroupList()) {
        let updata = this.getBilibiUpPushData(g)
        if (Object.keys(updata).length == 0) continue
        for (let item of Object.values(updata)) {
            let liveData = await this.getRoomInfobymid(item.uid)
            if (!liveData) continue
            if (item.dynamicType && !item.dynamicType.includes('live')) continue
            if (item.unpush && item.unpush.includes('live')) continue
            let data = {}
            if (liveData.live_status == 1 && !updata[item.uid].liveData) {
                let text = '', imglist = '', video, orig = '', liveInfo, comment = ''
                data.type = "直播"
                data.url = "https://live.bilibili.com/" + liveData.room_id
                data.id = liveData.room_id
                updata[item.uid].liveData = liveData
                liveInfo = {
                    cover: liveData.user_cover,
                    title: liveData.title,
                    live_time: liveData.live_time,
                    area_name: liveData.area_name,
                    watched_show: liveData.online
                }
                data.author = {
                    nickname: updata[item.uid].nickname,
                    img: updata[item.uid].img,
                    pendantImg: updata[item.uid].pendantImg
                }
                let isatall = updata[item.uid]?.isatall ? this.segment.at('all') : ''
                let msg = [`${updata[item.uid].nickname}开播啦！小伙伴们快去围观吧！`]
                data = { ...data, text, imglist, video, orig, liveInfo, comment, date: moment(liveData.live_time).format("YYYY年MM月DD日 HH:mm:ss") }
                await this.bot.pickGroup(g).sendMsg([isatall, msg, this.segment.image(liveData.user_cover), `标题：${liveInfo.title}\n`, `分区：${liveInfo.area_name}\n`, `直播间地址：${data.url}`])
            }
            if (liveData?.live_status !== 1) {
                updata[item.uid].liveData?.live_time ? await this.bot.pickGroup(g).sendMsg([this.segment.image(liveData.user_cover), '主播下播la~~~~\n', `本次直播时长：${this.getDealTime(moment(updata[item.uid].liveData.live_time), moment())}`]) : ''
                delete updata[item.uid].liveData
            }
            this.setBilibiUpPushData(g, updata)
        }
    }
}

async function livepushall(e) {
    let mid = e.msg.replace(/#(取消|)直播推送全体/g, "")
    let isatall = true
    if (!mid) {
        return e.reply("请输入B站用户id或者用户昵称！")
    }
    if (isNaN(mid)) {
        let data = await this.getSearchUser(mid)
        if (!data) {
            return e.reply("没有找到该用户呢！")
        }
        mid = `${data.mid}`
    }
    let updata = this.getBilibiUpPushData(e.group_id) || {}
    if (!updata[mid]) {
        return this.reply("你还没订阅这个up主呢！")
    }
    let info = await this.bot.getGroupMemberInfo(e.group_id, this.bot.uin)
    if (info.role != 'owner' && info.role != 'admin') {
        return this.reply("我不是管理员不能@全体呢！")
    }
    if (e.msg.includes("取消")) {
        isatall = false
    }
    updata[mid] = { ...updata[mid], isatall: isatall }
    this.setBilibiUpPushData(e.group_id, updata)
    this.reply(`已${isatall ? '设置' : '取消'}${updata[mid].nickname}的直播推送@全体！`)
}

async function getPushList(e) {
    let updata = this.getBilibiUpPushData(e.group_id) || {}
    let msg = '订阅列表如下：'
    if (Object.keys(updata).length === 0) {
        return this.reply("这个群还没订阅任何up主呢！")
    }
    Object.values(updata).forEach(item => {
        msg += `\n昵称：${item.nickname} (${((item?.dynamicType?.map(t => {
            return t !== 'all' ? dynamicType[t] + '√' : ''
        }).join('、') || '') + (item?.unpush?.map(t => {
            return dynamicType[t] + 'X'
        }).join('、') || '')) || '全部'})`
    })
    msg += '\n√表示只推送的类型，X代表禁止推送的类型'
    this.reply(msg)
}

async function getupdateDynamic(e) {
    let mid = e.msg.replace(new RegExp(e.reg), "")
    if (!mid) {
        return e.reply("请输入B站用户id或者用户昵称！")
    }
    if (isNaN(mid)) {
        let data = await this.getSearchUser(mid)
        if (!data) {
            return e.reply("没有找到该用户呢！")
        }
        mid = `${data.mid}`
    }
    let data = await this.getFirstDynamic(mid)
    if (data?.code && data.code != 0) {
        return e.reply(reslut.message || reslut.msg)
    } else if (data.code == 0) {
        return this.reply("这个up还没发布过动态呢！")
    }
    let bglist = this.File.GetfileList('/resources/html/bilibili/bg')
    let radom = bglist[lodash.random(0, bglist.length - 1)]
    await this.reply(await this.render('bilibili', { radom, ...data }))
    let imglist = [];
    if (data.imglist) {
        imglist = data.imglist.map(item => {
            return { content: this.segment.image(item) }
        })
    }
    if (data.orig?.imglist) {
        data.orig?.imglist.forEach(item => {
            imglist.push({ content: this.segment.image(item) })
        })
    }
    if (imglist.length > 0 && data.type != '专栏') {
        await this.reply(await this.makeGroupMsg('动态图片', imglist, true))
    }
}



export { setUpPush, delUpPush, pushdynamic, getupdateDynamic, livepush, livepushall, getPushList }