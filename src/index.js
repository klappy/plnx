
import crypto       from "crypto";
import querystring  from "querystring";

import debug        from "debug";
import request      from "request";
import nonce        from "nonce";
import autobahn     from "autobahn";

import config       from "./config";

let dbg = debug("plnx");

for (let command in config.commands) {
  let cfg = config.commands[command];

  exports[command] = function(opt, cb) {
    let ks         = typeof opt.key === "string" && typeof opt.secret === "string";
    let is_private = cfg.type === "private" || (cfg.type === "both" && ks);

    if (arguments.length === 1) {
      cb  = opt;
      opt = {};
    }

    if (typeof cb !== "function")
      throw new Error(`${command}: callback is not a function`);

    if (is_private && !ks)
      return cb(`${command}: opt.key and opt.secret are required`);

    let key    = opt.key;
    let secret = opt.secret;

    delete opt.key;
    delete opt.secret;

    let missing = [];

    if (cfg.type === "both")
      cfg.params = cfg.params[is_private ? "private" : "public"];

    for (let param of cfg.params)
      if (param.slice(-1) !== "?" && typeof opt[param] === "undefined")
        missing.push(param);

    if (missing.length)
      return cb(`${command}: ${missing} required`);

    let ropt = { json: true };

    opt["command"] = command;
    opt["nonce"]   = nonce()();

    if (is_private) {
      ropt["method"]   = "POST";
      ropt["url"]      = config.url.private;
      ropt["form"]     = opt;
      ropt["headers"]  = {
        Key:  key,
        Sign: crypto
          .createHmac('sha512', new Buffer(secret))
          .update(querystring.stringify(opt))
          .digest('hex')
      };
    }
    else {
      ropt["method"] = "GET";
      ropt["url"]    = config.url.public;
      ropt["qs"]     = opt;
    }

    request(ropt, (err, res, data) => {
      if (!err && data && data.error)
        err = data.error;

      if (err)
        return cb(err);

      cb(null, data);
    });

    dbg({ key, secret, opt, is_private });
  };
}

// fix poloniex api docs
exports.return24Volume = exports.return24hVolume;

let ab;

exports.push = (onopen) => {
  let conn = new autobahn.Connection({ url: config.url.push, realm: "realm1" });
  conn.onopen = onopen;
  conn.open();
};