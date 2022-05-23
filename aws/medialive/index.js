const AWS = require("aws-sdk");
const mediaLive = new AWS.MediaLive({ region: "ap-northeast-2" });

const createInput = async (parameters) => {
  const input = await mediaLive.createInput(parameters).promise();

  return input;
};

const deleteInput = async (parameters) => {
  const input = await mediaLive.deleteInput(parameters).promise();

  return input;
};

const listInputs = async (parameters) => {
  const list = await mediaLive.listInputs(parameters).promise();

  return list;
};

const describeInput = async (parameters) => {
  const input = await mediaLive.describeInput(parameters).promise();

  return input;
};

const describeChannel = async (parameters) => {
  const channel = await mediaLive.describeChannel(parameters).promise();

  return channel;
};

const createChannel = async (parameters) => {
  const channel = await mediaLive.createChannel(parameters).promise();

  return channel;
};

const updateChannel = async (parameters) => {
  const channel = await mediaLive.updateChannel(parameters).promise();

  return channel;
};

const deleteChannel = async (parameters) => {
  const channel = await mediaLive.deleteChannel(parameters).promise();

  return channel;
};

const startChannel = async (parameters) => {
  const channel = await mediaLive.startChannel(parameters).promise();

  return channel;
};

const stopChannel = async (parameters) => {
  const channel = await mediaLive.stopChannel(parameters).promise();

  return channel;
};

const listChannels = async (parameters) => {
  const listChannels = await mediaLive.listChannels(parameters).promise();

  return listChannels;
};

const batchUpdateSchedule = async (parameters) => {
  const updatedSchedule = await mediaLive
    .batchUpdateSchedule(parameters)
    .promise();

  return updatedSchedule;
};

const describeSchedule = async (parameters) => {
  const schedule = await mediaLive.describeSchedule(parameters).promise();

  return schedule;
};

const waitFor = async (state, parameters) => {
  const task = await mediaLive.waitFor(state, parameters).promise();

  return task;
};

const streamStatusCheck = async (channel) => {
  const channelId = channel.liveChannelId;

  const data = await describeChannel({ ChannelId: channelId });
  const pipelineDetail = data && data.PipelineDetails[0];

  return {
    engine: channel.engine,
    channel: channel.code,
    stream: pipelineDetail.ActiveInputAttachmentName || "",
    state: data.State,
    connected: data.State === "RUNNING",
  };
};

module.exports = {
  listChannels,
  listInputs,
  createInput,
  deleteInput,
  updateChannel,
  deleteChannel,
  startChannel,
  stopChannel,
  describeInput,
  createChannel,
  batchUpdateSchedule,
  describeSchedule,
  describeChannel,
  waitFor,
  streamStatusCheck,
};
