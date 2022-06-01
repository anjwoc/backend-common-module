const util = require("util");
const fs = require("fs");
const exec = util.promisify(require("child_process").exec);

const isEmpty = (val) => val == null || !(Object.keys(val) || val).length;

const randomString = (length) => {
  return Math.random()
    .toString(36)
    .substring(2, length + 2);
};

const validation = (schema, data) => {
  const valid = schema.validate(data);

  if (valid.error) {
    return valid.error;
  }

  return valid;
};

const limitString = (str, length) => {
  if (str.length > length) {
    return str.substring(0, length);
  }
  return str;
};

const isISOString = (value) => {
  const date = new Date(value);
  return !Number.isNaN(date.valueOf()) && date.toISOString() === value;
};

const imageStream = async (url, path) => {
  const writer = fs.createWriteStream(path);
  const res = await axios.get(url, { responseType: "stream" });

  res.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
};

// create buffer to blob object in node.js v14.17.4
const toArrayBuffer = (buf) => {
  const arraybuffer = Uint8Array.from(buf).buffer;

  return arraybuffer;
};

const base64 = {
  encode: (str) => {
    return Buffer.from(str, "utf8").toString("base64");
  },
  decode: (str) => {
    return Buffer.from(str, "base64").toString("utf8");
  },
};

const removeEscpaeCharacters = (string) => {
  let result = "";
  const escapes = {
    "\\b": "\\b",
    "\\t": "\\t",
    "\\n": "\\n",
    "\\f": "\\f",
    "\\r": "\\r",
    '"': '\\"',
    "\\\\": "\\\\",
  };

  Object.keys(escapes).forEach((key) => {
    const regex = new RegExp(`'${key}'`, "gi");
    result = string.replace(regex, escapes[key]);
  });

  return result;
};

const zip = (rows) => {
  return rows[0].map((_, i) => {
    return rows.map((arr) => {
      return arr[i];
    });
  });
};

const pipe =
  (...funcs) =>
  (...v) => {
    return funcs.reduce(async (res, func) => {
      return await func(...res);
    }, v);
  };

const pipeAsyncFunctions =
  (...fns) =>
  (...arg) =>
    fns.reduce((p, f) => p.then(f), Promise.resolve(arg));

const chunkList = async (filePath, size) => {
  const buffers = [];
  const stream = fs.createReadStream(filePath, { highWaterMark: size });

  return new Promise((resolve, reject) => {
    stream.on("error", (err) => {
      console.error(err);
      resolve(reject);
    });

    stream.on("data", (chunk) => {
      buffers.push(chunk);
    });

    stream.on("end", () => {
      resolve(buffers);
    });
  });
};

module.exports = {
  isEmpty,
  randomString,
  validation,
  limitString,
  isISOString,
  exec,
  toArrayBuffer,
  base64,
  removeEscpaeCharacters,
  zip,
  pipe,
  chunkList,
};
