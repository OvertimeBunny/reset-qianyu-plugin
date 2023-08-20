import fetch from "node-fetch";
import https from 'https'
import { Response } from 'node-fetch';
let controller = new AbortController();
let signal = controller.signal;
export default class networks {

    constructor(data) {
        this.url = data.url
        this.headers = data.headers || {}
        this.type = data.type || 'json'
        this.method = data.method || 'get'
        this.body = data.body || ''
        this.data = {}
        this.agent = data.isAgent ? new https.Agent({
            rejectUnauthorized: false,
        }) : ''
        this.signal = data.issignal ? signal : undefined
        this.timeout = data.timeout || 15000
        this.isGetResult = false
        this.timeout = ''
    }

    get config() {
        let data = {
            headers: this.headers,
            method: this.method,
            agent: this.agent,
            signal: this.signal
        }
        if (this.method == 'post') {
            data = { ...data, body: JSON.stringify(this.body) || '' }
        }
        return data
    }

    async getfetch() {
        try {
            if (this.method == 'post') {
                data = { ...data, body: JSON.stringify(this.body) || '' }
            }
            let result = await this.returnResult()
            if (result.status === 504) {
                return result
            }
            this.isGetResult = true
            return result
        } catch (error) {
            console.log(error);
            return false
        }

    }

    async returnResult() {
        if (this.timeout && this.signal) {
            return Promise.race([this.timeoutPromise(this.timeout), fetch(this.url, this.config)]).then(res => {
                clearTimeout(this.timeout);
                return res
            })
        }
        return fetch(this.url, this.config)
    }

    async getData(new_fetch = '') {
        try {
            if (!new_fetch) {
                let result = await this.returnResult()
                if (result.status === 504) {
                    return result
                }
                this.fetch = result
                this.isGetResult = true
            } else {
                this.fetch = new_fetch
            }
            switch (this.type) {
                case 'json':
                    await this.Tojson()
                    break;
                case 'text':
                    await this.ToText()
                    break;
                case 'arrayBuffer':
                    await this.ToArrayBuffer()
                    break;
                case 'blob':
                    await this.ToBlob()
                    break;
            }
            return this.fetch
        } catch (error) {
            console.log(error);
            return false
        }

    }

    async Tojson() {
        if (this.fetch.headers.get('content-type').includes('json')) {
            this.fetch = await this.fetch.json()
        } else {
            this.fetch = await this.fetch.text()
            this.type = 'text'
        }
    }

    async ToText() {
        this.fetch = await this.fetch.text()
    }

    async ToArrayBuffer() {
        this.fetch = await this.fetch.arrayBuffer()
    }
    async ToBlob() {
        this.fetch = await this.fetch.blob()
    }


    timeoutPromise(timeout) {
        return new Promise((resolve, reject) => {
            this.timeout = setTimeout(() => {
                resolve(new Response("timeout", { status: 504, statusText: "timeout " }));
                controller.abort()
            }, timeout);
        });
    }
}