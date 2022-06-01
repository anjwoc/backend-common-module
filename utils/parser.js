const parser = require("xml2js");

const xml2json = (xml) => {
  return "";
};

const json2xml = (json) => {
  const builder = new parser.Builder();
  const xml = builder.buildObject(json);

  return xml;
};

module.exports = {
  xml2json,
  json2xml,
};
