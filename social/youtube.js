const fs = require("fs");
const url = require("url");
const open = require("open");
const axios = require("axios");
const moment = require("moment");
const rimraf = require("rimraf");
const FormData = require("form-data");
const GoogleAPI = require("googleapis");

const db = require("../model");
const wowza = require("./wowza");
const util = require("../utils");
const config = require("../config");

const google = GoogleAPI.google;
const youtubeAnalytics = google.youtubeAnalytics("v2");
const youtube = google.youtube("v3");

const serviceType = config.wowza.serviceName;

const scopes = [
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtubepartner",
  "https://www.googleapis.com/auth/yt-analytics-monetary.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];
let oAuthClient = new google.auth.OAuth2(
  config.youtube.clientId,
  config.youtube.clientSecret,
  config.youtube.redirectUrl
);

oAuthClient.setCredentials({
  refresh_token: config.youtube.refreshToken,
});

const authenticate = async () => {
  const { token } = await oAuthClient.getAccessToken();
  axios.defaults.headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
  google.options({ auth: oAuthClient });
};

const getAuthUrl = async () => {
  const url = await oAuthClient.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
  });

  return url;
};

const getAccessToken = async (code) => {
  const { tokens } = await oAuthClient.getToken(code);
  oAuthClient.setCredentials(tokens);

  return tokens;
};

const login = () => {
  const authorizeUrl = oAuthClient.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
  });

  open(authorizeUrl, { wait: false }).then((childProcess) => {
    childProcess.unref();
  });
};

const listVideos = async () => {
  const service = google.youtube("v3");
  const res = await service.videos.list({
    auth: oAuthClient,
    part: "snippet, statistics",
    fields:
      "items(snippet(title, description, channelId), statistics(viewCount, likeCount, commentCount))",
    myRating: "like",
  });

  return res.data;
};

const statisticsByPopularity = async (
  startDate,
  endDate,
  channelId = "",
  onwerId = "",
  filters = ""
) => {
  const params = {
    startDate: startDate,
    endDate: endDate,
    dimensions: "video",
    metrics: "views",
    filters: channelId ? `channel=${channelId}` : channelId,
    maxResults: 10,
    sort: "-views",
    ids: onwerId ? `contentOwner==${onwerId}` : "channel==MINE",
  };

  const res = await youtubeAnalytics.reports.query(params);

  const listVideoId = [];
  const listViews = [];
  res.data.rows.forEach((item) => {
    listVideoId.push(item[0]);
    listViews.push(item[1]);
  });
  const response = await google.youtube("v3").videos.list({
    part: "id, snippet",
    id: listVideoId.join(","),
    onBehalfOfContentOwner: onwerId,
  });

  const result = response.data.items.map((item, idx) => {
    return {
      id: listVideoId[idx],
      title: item.snippet.title,
      views: listViews[idx],
      thumbnails: item.snippet.thumbnails,
    };
  });
  return result;
};

/**
 * 채널의 총 조회수, 시청 시간, 평균 재생 시간
 * * views: 동영상을 본 횟수
 * * estimatedMinutesWatched: 사용자가 지정된 채널, 콘텐츠, 소유자, 영상 또는 재생목록의 영상을 시청한 시간(분)
 * * averageViewDuration: 영상의 평균 재생 시간
 * * averageViewPercentage: 동영상 재생 중 시청한 동영상의 평균 비율
 * @param {date} startDate 시작 일 (YYYY-MM-DD)
 * @param {date} endDate 종료 일 (YYYY-MM-DD)
 * @param {string} channelId 채널 아이디
 * @param {stirng} onwerId 소유자 아이디
 * @returns object
 */
const statisticsByChannel = async (
  startDate,
  endDate,
  channelId = "",
  onwerId = ""
) => {
  const params = {
    startDate: startDate,
    endDate: endDate,
    dimensions: "channel",
    metrics:
      "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes",
    filters: channelId ? `channel=${channelId}` : channelId,
    ids: onwerId ? `contentOwner==${onwerId}` : "channel==MINE",
  };
  const res = await youtubeAnalytics.reports.query(params);
  return res.data;
};

/**
 * 일 별 총 조회수, 시청 시간, 평균 재생 시간
 * * views: 동영상을 본 횟수
 * * estimatedMinutesWatched: 사용자가 지정된 채널, 콘텐츠 소유자, 동영상 또는 재생목록의 동영상을 시청한 시간(분)
 * * averageViewDuration: 영상의 평균 재생 시간
 * @param {date} startDate 시작 일 (YYYY-MM-DD)
 * @param {date} endDate 종료 일 (YYYY-MM-DD)
 * @param {string} channelId 채널 아이디
 * @param {stirng} onwerId 소유자 아이디
 * @returns object
 */
const statisticsByDay = async (
  startDate,
  endDate,
  channelId = "",
  onwerId = ""
) => {
  const params = {
    startDate: startDate,
    endDate: endDate,
    dimensions: "day",
    metrics:
      "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes",
    filters: channelId ? `channel=${channelId}` : channelId,
    sort: "day",
    ids: onwerId ? `contentOwner==${onwerId}` : "channel==MINE",
  };
  const res = await youtubeAnalytics.reports.query(params);
  return res.data;
};

/**
 * 월 별 총 조회수, 시청 시간, 평균 재생 시간
 * * views: 동영상을 본 횟수
 * * estimatedMinutesWatched: 사용자가 지정된 채널, 콘텐츠 소유자, 동영상 또는 재생목록의 동영상을 시청한 시간(분)
 * * averageViewDuration: 영상의 평균 재생 시간
 * @param {date} startDate 시작 일 (YYYY-MM-DD)
 * @param {date} endDate 종료 일 (YYYY-MM-DD)
 * @param {string} channelId 채널 아이디
 * @param {stirng} onwerId 소유자 아이디
 * @returns object
 */
const statisticsByMonth = async (
  startDate,
  endDate,
  channelId = "",
  onwerId = ""
) => {
  const params = {
    startDate: moment(startDate).set("date", 1).format("YYYY-MM-DD"),
    endDate: moment(endDate).set("date", 1).format("YYYY-MM-DD"),
    dimensions: "month",
    metrics:
      "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes",
    filters: channelId ? `channel=${channelId}` : channelId,
    sort: "month",
    ids: onwerId ? `contentOwner==${onwerId}` : "channel==MINE",
  };
  const res = await youtubeAnalytics.reports.query(params);
  return res.data;
};

/**
 * 나라 별 총 조회수, 시청 시간, 평균 재생 시간, 평균 비율 통계
 * * views: 동영상을 본 횟수
 * * estimatedMinutesWatched: 사용자가 지정된 채널, 콘텐츠 소유자, 동영상 또는 재생목록의 동영상을 시청한 시간(분)
 * * averageViewDuration: 영상의 평균 재생 시간
 * * averageViewPercentage: 동영상 재생 중 시청한 동영상의 평균 비율
 * @param {date} startDate 시작 일 (YYYY-MM-DD)
 * @param {date} endDate 종료 일 (YYYY-MM-DD)
 * @param {string} channelId 채널 아이디
 * @param {string} onwerId 소유자 아이디
 * @returns object
 */
const statisticsByCountry = async (
  startDate,
  endDate,
  channelId = "",
  onwerId = ""
) => {
  const params = {
    startDate: startDate,
    endDate: endDate,
    dimensions: "country",
    metrics:
      "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes",
    filters: channelId ? `channel=${channelId}` : channelId,
    maxResults: 5,
    sort: "-views",
    ids: onwerId ? `contentOwner==${onwerId}` : "channel==MINE",
  };

  const res = await youtubeAnalytics.reports.query(params);
  return res.data;
};

/**
 * 나라 별 총 조회수, 시청 시간, 평균 재생 시간, 평균 비율 통계
 * * views: 동영상을 본 횟수
 * * estimatedMinutesWatched: 사용자가 지정된 채널, 콘텐츠 소유자, 동영상 또는 재생목록의 동영상을 시청한 시간(분)
 * * averageViewDuration: 영상의 평균 재생 시간
 * * averageViewPercentage: 동영상 재생 중 시청한 동영상의 평균 비율
 * @param {date} startDate 시작 일 (YYYY-MM-DD)
 * @param {date} endDate 종료 일 (YYYY-MM-DD)
 * @param {string} channelId 채널 아이디
 * @param {string} onwerId 소유자 아이디
 * @returns object
 */

const totalViews = async (startDate, endDate, channelId = "", onwerId = "") => {
  const params = {
    startDate: startDate,
    endDate: endDate,
    dimensions: "channel",
    metrics: "views",
    filters: channelId ? `channel=${channelId}` : channelId,
    sort: "-views",
    ids: onwerId ? `contentOwner==${onwerId}` : "channel==MINE",
  };

  const res = await youtubeAnalytics.reports.query(params);
  return res.data;
};

const totalWatchTime = async (
  startDate,
  endDate,
  channelId = "",
  onwerId = ""
) => {
  const params = {
    startDate: startDate,
    endDate: endDate,
    dimensions: "channel",
    metrics: "estimatedMinutesWatched",
    filters: channelId ? `channel=${channelId}` : channelId,
    sort: "-estimatedMinutesWatched",
    ids: onwerId ? `contentOwner==${onwerId}` : "channel==MINE",
  };

  const res = await youtubeAnalytics.reports.query(params);
  return res.data;
};

const totalLikes = async (startDate, endDate, channelId = "", onwerId = "") => {
  const params = {
    startDate: startDate,
    endDate: endDate,
    dimensions: "channel",
    metrics: "likes",
    filters: channelId ? `channel=${channelId}` : channelId,
    sort: "-likes",
    ids: onwerId ? `contentOwner==${onwerId}` : "channel==MINE",
  };

  const res = await youtubeAnalytics.reports.query(params);
  return res.data;
};

const toObject = (data) => {
  const result = [];
  const names = data.columnHeaders.map((column) => column.name);
  data.rows.forEach((row) => {
    const data = {};
    row.forEach((item, idx) => {
      data[names[idx]] = item;
    });
    result.push(data);
  });

  return result;
};

const formatByDate = (data) => {
  const headers = data.columnHeaders.map((column) => column.name);
  const names = headers.slice(1, headers.length);
  const result = {};

  data.rows.forEach((row) => {
    const key = row[0];

    if (!result[key]) {
      result[key] = {};
    }
    row.slice(1, row.length).forEach((value, idx) => {
      const metricKey = names[idx];
      result[key][metricKey] = value;
    });
  });

  return result;
};

const format = {
  channel: (data) => toObject(data),
  day: (data) => formatByDate(data),
  month: (data) => formatByDate(data),
  country: (data) => toObject(data),
  popularity: (data) => data,
};

const insertLiveStreams = async (title, description) => {
  const stream = await youtube.liveStreams.insert({
    part: ["id,snippet,cdn,contentDetails,status"],
    requestBody: {
      snippet: {
        title: title,
        description: description,
      },
      cdn: {
        resolution: "variable",
        frameRate: "variable",
        ingestionType: "rtmp",
      },
      contentDetails: {
        isReusable: true,
      },
    },
  });

  return stream.data;
};

const updateLiveStreams = async () => {
  const res = await youtube.liveStreams.update({
    part: ["id,snippet,cdn,contentDetails,status"],
    requestBody: {
      snippet: {
        title: "Live Stream",
        description: "This is a live stream.",
      },
      cdn: {
        frameRate: "60fps",
        resolution: "1080p",
        ingestionType: "rtmp",
      },
      contentDetails: {
        isReusable: true,
      },
    },
  });

  return res.data;
};

const deleteLiveStreams = async (id) => {
  const res = await youtube.liveStreams.delete({ id: id });

  return res.data;
};

const listLiveStreams = async () => {
  const streams = await youtube.liveStreams.list({
    part: ["id,snippet,cdn,contentDetails,status"],
    broadcastType: "all",
    mine: true,
  });

  return streams.data;
};

const findLiveStream = async (id) => {
  const liveStream = await youtube.liveStreams.list({
    part: ["id,snippet,cdn,contentDetails,status"],
    id: id,
  });
  const isExists = liveStream.data.items.length;

  if (isExists) return {};

  return liveStream.data.items[0];
};

const insertLiveBroadcasts = async (title, description, options) => {
  const startTime = options.startTime || moment(new Date()).toISOString();
  const privacyStatus = options.privacyStatus || "public";

  const broadcast = await youtube.liveBroadcasts.insert({
    part: ["id,snippet,status,contentDetails"],
    requestBody: {
      snippet: {
        title: title,
        description: description,
        scheduledStartTime: startTime,
      },
      status: {
        privacyStatus: privacyStatus,
      },
      contentDetails: {
        enableAutoStart: true,
        enableAutoStop: true,
        enableDvr: false,
        enableLowLatency: true,
        monitorStream: {
          enableMonitorStream: true,
        },
      },
    },
  });

  return broadcast.data;
};

const updateLiveBroadcasts = async (
  broadcastId,
  title,
  description,
  startTime = moment(new Date()),
  privacyStatus = "private"
) => {
  // youtube streaming api liveBroadcast update example
  const broadcast = await youtube.liveBroadcasts.update({
    part: ["id,snippet,contentDetails,status"],
    requestBody: {
      id: broadcastId,
      snippet: {
        title: title,
        description: description,
        scheduledStartTime: moment(startTime).toISOString(),
      },
      status: {
        privacyStatus: privacyStatus,
        madeForKids: false,
      },
      contentDetails: {
        enableDvr: true,
        enableContentEncryption: true,
        enableLowLatency: true,
        enableEmbed: true,
        monitorStream: {
          enableMonitorStream: true,
        },
        scheduledStartTime: moment(startTime).toISOString(),
      },
    },
  });

  return broadcast.data;
};

const listLiveBroadcasts = async (broadcastStatus, broadcastId) => {
  const broadcasts = await youtube.liveBroadcasts.list({
    part: "id,snippet,status,contentDetails",
    broadcastStatus: broadcastStatus,
  });

  return broadcasts.data;
};

const findLiveBroadcasts = async (broadcastId) => {
  const broadcasts = await listLiveBroadcasts({ id: broadcastId });
  const isExists = broadcasts.data.items.length;

  if (!isExists) return {};

  return broadcasts.data.items[0];
};

const deleteLiveBroadcasts = async (broadcastId) => {
  const res = await youtube.liveBroadcasts.delete({ id: broadcastId });

  return res.data;
};

const bindLiveBrodacasts = async (broadcastId, streamId) => {
  const res = await youtube.liveBroadcasts.bind({
    id: broadcastId,
    part: ["snippet,contentDetails,status"],
    streamId: streamId,
  });

  return res.data;
};

const liveStreams = {
  insert: insertLiveStreams,
  update: updateLiveStreams,
  delete: deleteLiveStreams,
  list: listLiveStreams,
  find: findLiveStream,
};

const liveBroadcasts = {
  insert: insertLiveBroadcasts,
  list: listLiveBroadcasts,
  update: updateLiveBroadcasts,
  delete: deleteLiveBroadcasts,
  bind: bindLiveBrodacasts,
  find: findLiveBroadcasts,
};

const playlist = (streamId) => {
  return {
    live: `https://youtube.com?watch`,
  };
};

const syndicationStartMediaLive = async (params) => {
  const { type, code, title, description = "", privacyStatus } = params;
  const channel = await db.channel.findOne({ where: { code: code } });

  const streamKeyName = `${code}-${type}-${title}`.replace(/ /gi, "");
  const social = channel.dataValues.social[type];
  const { streamId } = social;

  const liveStream = await liveStreams.insert(streamKeyName, description);
  // const liveStream = streamId ? await liveStreams.find(streamId) : await liveStreams.insert(streamKeyName, description);

  const connectionInfo = {
    ...social,
    isSyndication: true,
    streamId: liveStream.id,
    streamingUrl: liveStream.cdn.ingestionInfo.ingestionAddress,
    streamingKey: liveStream.cdn.ingestionInfo.streamName,
    liveUrl: "",
  };

  const broadcast = await liveBroadcasts.insert(
    title,
    description,
    privacyStatus
  );
  const bindStream = await liveBroadcasts.bind(broadcast.id, liveStream.id);
  connectionInfo.broadcastId = broadcast.id;

  const liveUrl = `https://youtu.be/${broadcast.id}`;
  connectionInfo.liveUrl = liveUrl;

  channel.dataValues.social[type] = connectionInfo;
  await db.channel.update(
    { social: channel.dataValues.social },
    { where: { code: code } }
  );

  return {
    liveUrl: liveUrl,
  };
};

const syndicationStopMediaLive = async (params) => {
  const { type, code } = req.body;
  const channel = await db.channel.findOne({ where: { code: code } });
  const connectionInfo = channel.dataValues.social[type];
  const { streamId, broadcastId } = connectionInfo;

  await youtube.liveBroadcasts.delete(broadcastId);
  await youtube.liveStreams.delete(streamId);

  channel.dataValues.social[type] = template.youtube;

  await db.channel.update(
    {
      social: channel.dataValues.social,
    },
    { where: { code: code } }
  );

  return { result: "success" };
};

module.exports = {
  google,
  oAuthClient,
  getAuthUrl,
  getAccessToken,
  login,
  authenticate,
  listVideos,
  statisticsByDay,
  statisticsByMonth,
  statisticsByChannel,
  statisticsByCountry,
  statisticsByPopularity,
  toObject,
  format,
  totalViews,
  totalWatchTime,
  totalLikes,
  liveStreams,
  liveBroadcasts,
  syndicationStartMediaLive,
  syndicationStopMediaLive,
};
