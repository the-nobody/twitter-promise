"use strict"

const request = require("request");
const {EventEmitter} = require("events");

class Twitter {
	constructor(auth) {
		this.version = require("../package.json").version;
    this.events = new EventEmitter();
    this._backoff = {};
		this._endpoint = "https://api.twitter.com/1.1/";
    this._stream = "https://stream.twitter.com/1.1/statuses/filter.json";
		this._request_options = {
			oauth: {
        consumer_key: auth.consumer_key,
        consumer_secret: auth.consumer_secret,
        token: auth.token,
        token_secret: auth.token_secret
      },
			headers: {
				Accept: "*/*",
				Connection: "close",
				"User-Agent": "twitter-promise-" + this.version,
			}
		};
		this._request = request.defaults(this._request_options);
	}
	
  // check back off satus for a specific endpoint.
	_shouldBackoff(opts) {
    if (!this._backoff.hasOwnProperty(opts.path)) return false;
    const _stop = this._backoff[opts.path] > Date.now();
    if (!_stop) delete this._backoff[opts.path];
    return _stop;
	}

  // helper function to set back off status for an end point based on the api response from the headers.
	_checkBackoff(path, headers) {
    let api = {
      limit: headers["x-rate-limit-limit"] || 15,
      remain: headers["x-rate-limit-remaining"] || 1,
      reset: headers["x-rate-limit-reset"] || Date.now(),
    };
    
    return new Promise((resolve, reject) => {
      if (headers.status !== "200 OK") {
        reject({
          type: "HTTP_STATUS",
          headers,
          path,
          api,
        });
      }

      if (!api.remain) {
        this._backoff[path] = api.reset;
        reject({
          type: "RATE_LIMIT",
          headers,
          path,
          api
        });
      }
      else {
        resolve({
          type: "SUCCESS",
          headers,
          path,
          api
        });
      }
    })
  }

  // return a formatted endpoint string
	endpoint(path, stream=false) {
    const _endpoint = !stream ? this._endpoint : this._stream;
		return `${_endpoint}${path}.json`;
	}
	
  // make a proper request to twitter using the this._request local
  // returns a promise
  // request is used as a helper function to get and post
	request(opts) {
    opts.params = opts.params || {};
    
		// build request options
		const _options = {
			method: opts.method ? opts.method.toLowerCase() : "get",
			uri: this.endpoint(opts.path)
		}
   
   if (_options.method === "get") {
     _options.qs = opts.params;
   }
   else {
     _options.form = opts.params;
   }
    
    // return new promise based on back off api status
    return new Promise((resolve,reject) => {
      // make the request
      if (this._shouldBackoff(opts.path)) {
        reject({msg: `${opts.path} is locked right now. Check back at: ${this._backoff[opts.path]}`, api: {}});
      }
      
      // make request to twitter
      this._request(_options, (err, res, data) => {
        if (err) reject(err); return;
        
        data = JSON.parse(data);
        // check backoff status of path and resolve or reject based on the end point api status
        this._checkBackoff(opts.path, res.headers)
          .then(msg => {
            resolve({ api:msg.api, data });
          })
          .catch(err => {
            reject(err);
          });
      });

    });
	}
	
  // makes a get request
	get(opts) {
		opts.method = "get";
		return this.request(opts);
	}
	
  // makes a post request
	post(opts) {
    opts.method = "post";
		return this.request(opts);
	}
  
  // open a twitter stream based on a passed in track parameter
  // uses the node event emitter to send events to itself that can be watched for.
  // this is useful when extending twitter into other components.
  stream(track) {
    const _opts = {
      method: "post",
      url: this._stream,
      qs: {
        track,
        language: "en",
        stall_warnings: true
      }
    };
    // create initial request with auth & options
    const _request = this._request(_opts);
    _request
      .on("response", response => {
        let buffer = "";
        
        if(response.statusCode !== 200) {
          this.events.emit("twitter:stream:error", { type: "STATUS", err: response.statusCode });
          this.events.emit("twitter:stream:abort", { type: "ABORT", response });
          _request.abort(); // abort reqeust
        }
        
        
        response.on("data", data => {
          let index, json;
          buffer += data.toString("utf8");
          
          while ((index = buffer.indexOf("\r\n")) > -1) {
            json = buffer.slice(0, index);
            buffer = buffer.slice(index + 2);
            if (json.length) {
              try {
                json = JSON.parse(json);
                this.events.emit("twitter:stream:success", json);
              }
              catch(err) {
                this.events.emit("twitter:stream:error", {type: "PARSE", err})
              }
            }
          }
        })
        // response error
        .on("error", err => {
          this.events.emit("twitter:stream:error", {type: "RESPONSE", err});
        })
        // response end
        .on("end", () => {
          this.events.emit("twitter:stream:end");
        });
      })
      // request error
      .on("error", err => {
        this.events.emit("twitter:stream:error", {type: "REQUEST", err})
      });
    _request.end();
  }
}

module.exports = Twitter;
