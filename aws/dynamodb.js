const AWS = require("aws-sdk");
const dynamoDB = new AWS.DynamoDB({ region: "ap-northeast-2" });

AWS.config.update({
  region: "ap-northeast-2",
  endpoint: config.ddb.endpoint,
});

const describeTable = async (tableName) => {
  const data = await dynamoDB.describeTable({ TableName: tableName }).promise();
  return data;
};

const putItem = async (params) => {
  const data = await dynamoDB.putItem(params);
  return data;
};

const parseJson = (data) => {
  try {
    return JSON.parse(data);
  } catch (err) {
    return data;
  }
};

const toJson = (items) => {
  const data = items.map((item) => {
    const obj = {};
    Object.entries(item).forEach(([key, value]) => {
      const val = parseJson(Object.values(value)[0]);
      obj[key] = val;
    });
    return obj;
  });

  return data;
};

module.exports = {
  putItem,
  toJson,
  describeTable,
};
