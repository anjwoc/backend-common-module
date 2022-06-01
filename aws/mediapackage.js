const AWS = require("aws-sdk");
const mediaPackage = new AWS.MediaPackage({ region: "ap-northeast-2" });

const listChannels = async (parameters) => {
  const result = await mediaPackage.listChannels(parameters).promise();

  return result;
};

const createChannel = async (parameters) => {
  const result = await mediaPackage.createChannel(parameters).promise();

  return result;
};

const deleteChannel = async (parameters) => {
  const result = await mediaPackage.deleteChannel(parameters).promise();

  return result;
};

const updateChannel = async (parameters) => {
  const result = await mediaPackage.updateChannel(parameters).promise();

  return result;
};

const describeChannel = async (parameters) => {
  const result = await mediaPackage.describeChannel(parameters).promise();

  return result;
};

const createOriginEndpoint = async (parameters) => {
  const result = await mediaPackage.createOriginEndpoint(parameters).promise();

  return result;
};

const listOriginEndpoints = async (parameters) => {
  const result = await mediaPackage.listOriginEndpoints(parameters).promise();

  return result;
};

const deleteOriginEndpoint = async (parameters) => {
  const result = await mediaPackage.deleteOriginEndpoint(parameters).promise();

  return result;
};

module.exports = {
  listChannels,
  createChannel,
  deleteChannel,
  updateChannel,
  describeChannel,
  createOriginEndpoint,
  listOriginEndpoints,
  deleteOriginEndpoint,
};
