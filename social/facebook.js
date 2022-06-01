const FormData = require("form-data");
const rimraf = require("rimraf");
const axios = require("axios");
const fs = require("fs");
const util = require("../utils");
const config = require("../config");

const accessToken = config.facebook.accessToken;

/**
 * @param {string} pageId 페이지 아이디
 * @returns object { pageAccessToken, pageId }
 */
const getPageAccessToken = async (pageId, accessToken) => {
  const url = `https://graph.facebook.com/${pageId}?fields=access_token&access_token=${accessToken}`;
  const res = await axios.get(url);

  return {
    pageAccessToken: res.data.access_token,
    pageId: res.data.id,
  };
};

const getAccessToken = async (accessToken) => {
  const userAuth = await axios.get(
    `https://graph.facebook.com/me?access_token=${accessToken}`
  );
  const userId = userAuth.data.id;

  const accountInfo = await axios.get(
    `https://graph.facebook.com/${userId}/accounts?access_token=${accessToken}`
  );
  const token = accountInfo.data.data[0].access_token;

  return { accessToken: token };
};

const getUserInfo = async (accessToken) => {
  try {
    const url = `https://graph.facebook.com/me?access_token=${accessToken}`;

    const res = await axios.get(url);
    const { name, id } = res.data;
    return {
      id: id,
      name: name,
    };
  } catch (err) {
    return err.response;
  }
};

const pageList = async (accessToken) => {
  const user = await getUserInfo(accessToken);
  const url = `https://graph.facebook.com/${user.id}/accounts?access_token=${accessToken}`;

  const res = await axios.get(url);
  const pages = {};
  res.data.forEach((item) => {
    pages[item.name] = item.id;
  });

  return pages;
};

const getPageId = async (accessToken) => {
  try {
    const user = await getUserInfo(accessToken);
    const url = `https://graph.facebook.com/${user.id}/accounts?access_token=${accessToken}`;

    const res = await axios.get(url);

    return res.data.data[0].id;
  } catch (err) {
    return err.response;
  }
};

const getTokens = async (code) => {
  try {
    const result = await db.snsSetup.findOne({
      where: {
        code: code,
      },
    });

    const tokens = result.delivery.token;

    return {
      accessToken: tokens.access_token,
      clientId: tokens.client_id,
      clientSecret: tokens.client_secret,
    };
  } catch (err) {
    return err.response;
  }
};

const pageInsights = async (pageId, accessToken, period, limit) => {
  try {
    const { pageAccessToken } = await getPageAccessToken(pageId, accessToken);
    const metric =
      "page_actions_post_reactions_total,page_impressions,page_post_engagements,page_consumptions,page_fans,page_views_total";
    const url = `https://graph.facebook.com/${pageId}/insights?access_token=${pageAccessToken}&metric=${metric}&period=${period}&limit=${limit}`;

    const res = await axios.get(url);

    const insights = [];
    res.data.data.forEach((item) => {
      const values = item.values;
      const lastIdx = values.length - 1;

      insights.push({
        endTime: values[lastIdx].end_time,
        [item.name]: values[lastIdx].value,
      });
    });

    return res.data;
  } catch (err) {
    return err.response.data;
  }
};

const pagePostInsights = async (pageId, accessToken, period, limit) => {
  try {
    const { pageAccessToken } = await getPageAccessToken(pageId, accessToken);
    const feedList = await pageFeedList(accessToken, pageId);

    const promises = feedList.map(async (feed) => {
      const metric = "post_reactions_by_type_total";
      const url = `https://graph.facebook.com/${feed.id}/insights?access_token=${pageAccessToken}&metric=${metric}`;
      const res = await axios.get(url);
      const feedInsight = res.data.data.map((item) => {
        return {
          name: item.name,
          values: item.values[0].value,
          id: item.id,
        };
      });

      return {
        id: feed.id,
        name: feed.message,
        insight: feedInsight,
      };
    });

    const feedInsights = await Promise.all(promises);

    return feedInsights;
  } catch (err) {
    return err.response.data;
  }
};

const liveStreamList = async (pageId, pageAccessToken) => {
  const url = `https://graph.facebook.com/${pageId}/live_videos?&access_token=${pageAccessToken}`;

  const res = await axios.get(url);

  const result = {};
  res.data.data.forEach((item) => {
    if (!result[item.status]) {
      result[item.status] = [];
    }

    result[item.status].push(item);
  });

  return result;
};

const createLiveStream = async (
  pageId,
  status,
  title,
  description,
  accessToken
) => {
  try {
    const query = {
      status: status,
      title: title,
      description: description,
      access_token: accessToken,
    };

    const querystring = Object.keys(query)
      .map((key) => `${key}=${encodeURIComponent(query[key])}`)
      .join("&");
    const url = `https://graph.facebook.com/${pageId}/live_videos?&${querystring}`;

    const res = await axios.post(url);

    return res.data;
  } catch (err) {
    return err.response.data;
  }
};

const deleteLiveStream = async (liveStreamId, accessToken) => {
  try {
    const query = {
      end_live_video: true,
      access_token: accessToken,
    };

    const querystring = Object.keys(query)
      .map((key) => `${key}=${encodeURIComponent(query[key])}`)
      .join("&");

    const url = `https://graph.facebook.com/${liveStreamId}?${querystring}`;

    const res = await axios.post(url);

    return res.data;
  } catch (err) {
    return err.response.data;
  }
};

const pageFeedList = async (accessToken, pageId) => {
  const url = `https://graph.facebook.com/${pageId}/feed?access_token=${accessToken}`;

  const res = await axios.get(url);
  const feedList = res.data.data;

  return feedList;
};

const insights = {
  page: pageInsights,
  post: pagePostInsights,
};

const liveStream = {
  create: createLiveStream,
  delete: deleteLiveStream,
  list: liveStreamList,
};

/**
 * @param {*} pageId 페이지 아이디
 * @param {*} videoPath 비디오 파일 경로
 * @param {*} accessToken 페이지 엑세스 토큰, 값이 없을 경우 사용자 엑세스 토큰으로 대체
 * @returns
 */
const uploadSessionInit = async (pageId, videoPath, accessToken) => {
  const formData = new FormData();
  const videoStat = fs.statSync(videoPath);
  const params = {
    upload_phase: "start",
    access_token: accessToken,
    file_size: videoStat.size,
  };

  Object.keys(params).forEach((key) => {
    formData.append(key, params[key]);
  });

  const url = `https://graph-video.facebook.com/v12.0/${pageId}/videos`;

  const res = await axios.post(url, formData, {
    headers: {
      ...formData.getHeaders(),
    },
  });

  return res.data;
};

const transfer = async (
  pageId,
  uploadSessionId,
  accessToken,
  chunk,
  startOffset
) => {
  const formData = new FormData();

  fs.writeFileSync("chunk", chunk);

  // formData에 parameter 적용
  const options = {
    upload_phase: "transfer",
    access_token: accessToken,
    upload_session_id: uploadSessionId,
    start_offset: startOffset,
    video_file_chunk: fs.createReadStream("chunk"),
  };
  Object.keys(options).forEach((key) => {
    formData.append(key, options[key]);
  });

  const url = `https://graph-video.facebook.com/v12.0/${pageId}/videos`;

  const headers = formData.getHeaders();

  const res = await axios.post(url, formData, {
    headers,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  const { start_offset } = res.data;
  return start_offset;
};

const finish = async (
  pageId,
  title,
  description,
  uploadSessionId,
  startOffset,
  accessToken
) => {
  const formData = new FormData();

  const options = {
    title: title ? title : "",
    description: description ? description : "",
    upload_phase: "finish",
    access_token: accessToken,
    upload_session_id: uploadSessionId,
    start_offset: startOffset,
  };

  const url = `https://graph-video.facebook.com/v12.0/${pageId}/videos`;

  Object.keys(options).forEach((key) => {
    formData.append(key, options[key]);
  });

  const headers = formData.getHeaders();

  const res = await axios.post(url, formData, {
    headers,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  return res.data;
};

module.exports = {
  getAccessToken,
  getPageAccessToken,
  uploadSessionInit,
  finish,
  transfer,
  insights,
  liveStream,
};
