import lodash from 'lodash'
import Base from '../model/base/Base.js'
export default class ai extends Base {
    constructor() {
        super({
            name: 'ai',
            priority: 1000,
            rule: [
                {
                    reg: '',
                    fnc: 'ffai',
                    log: false
                }
            ]
        })

        this.def_gaiCfg = {
            isOpen: false,
            aiType: "思知",
            gprobability: 0
        }
    }

    async ffai(e) {
        let config = this.Cfg
        let radom = lodash.random(1, 100)
        if (e.isGroup) {
            let gcfg = { ...this.def_gaiCfg, ...config[e.group_id] }
            if (e.user_id == e.self_id) return false
            if (!gcfg.isOpen) return false
            if (e.atBot || e.hasAlias) {
                return await this.getai(gcfg.aiType)
            }
            if (gcfg.isOpen && radom <= gcfg.gprobability) {
                return await this.getai(gcfg.aiType)
            }
        }
        if (e.isPrivate) {
            if (config.isPrivate == false) return ""
            if (radom <= config.probability) {
                return await this.getai(config.aiType)
            }
        }
        return false
    }

    async getai(aiType) {
        return await this.choieai(this.e.msg, aiType)
    }

    async choieai(msg, ai) {
        let ailist = this.Cfg.aiList
        let botname = await redis.get(`qianyu:ai:botname`)
        let aida = ailist.find(list => list.name == ai)
        if (!aida) return
        msg = msg.replace("#", "")
        let data = await new this.networks({ url: `${aida.url}${encodeURI(msg)}` }).getData()
        aida.data.forEach(item => {
            data = data[item]
        })
        return await this.reply(`${data.replace(/菲菲|小思|小爱|思知/g, botname ? botname : ai)}`)
    }



}

