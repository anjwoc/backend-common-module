const axios = require("axios");
const moment = require("moment");
const Twitter = require("twitter");

const db = require("../model");
const config = require("../config");

const client = new Twitter({
  consumer_key: config.twitter.apiKey,
  consumer_secret: config.twitter.apiKeySecret,
  access_token_key: config.twitter.accessToken,
  access_token_secret: config.twitter.accessTokenSecret,
});

axios.defaults.headers = {
  Authorization: `Bearer ${config.twitter.bearerToken}`,
  Accept: "application/json",
};

const getPage = async (url, params, nextToken) => {
  if (nextToken) {
    params.pagination_token = nextToken;
  }

  const res = await axios.get(url, { params: params });

  if (res.status != 200) {
    console.log(`${res.statusCode} ${res.statusMessage}:\n${res.body}`);
    return;
  }
  return res.data;
};

const followers = async (userId) => {
  const url = `${config.twitter.url}/users/${userId}/followers`;

  const params = {};

  const res = await axios.get(url, { params: params });

  if (!res.data || res.data.meta.result_count === 0) return;

  return res.data.data;
};

const retweets = async (tweetId) => {
  const url = `${config.twitter.url}/tweets/${tweetId}/retweeted_by`;

  const params = {};

  const res = await axios.get(url, { params: params });

  if (!res.data || res.data.meta.result_count === 0) return;

  return res.data.data;
};

// * type: retweet, quote, like, reply
const sortByRetweet = (tweets) => {
  const result = tweets.sort(
    (a, b) => b.metrics.retweet_count - a.metrics.retweet_count
  );

  return result;
};

const sortByQuote = (tweets) => {
  const result = tweets.sort(
    (a, b) => b.metrics.quote_count - a.metrics.quote_count
  );

  return result;
};

const sortByLike = (tweets) => {
  const result = tweets.sort(
    (a, b) => b.metrics.like_count - a.metrics.like_count
  );

  return result;
};

const sortByReply = (tweets) => {
  const result = tweets.sort(
    (a, b) => b.metrics.reply_count - a.metrics.reply_count
  );

  return result;
};

const sortBy = {
  retweet: sortByRetweet,
  like: sortByLike,
  reply: sortByReply,
  quote: sortByQuote,
};

const sortByDate = (type, startDate, endDate, dateformat, data) => {
  const dailyTopTweets = {};

  Object.keys(data).forEach((key) => {
    const value = data[key];
    const createdAt = moment(value.createdAt).format(dateformat);

    if (!dailyTopTweets[createdAt]) {
      dailyTopTweets[createdAt] = [];
    }

    dailyTopTweets[createdAt].push(value);
  });

  const initValue =
    type === "counts"
      ? [
          {
            metrics: {
              retweet_count: 0,
              reply_count: 0,
              like_count: 0,
              quote_count: 0,
            },
          },
        ]
      : [];
  for (
    let cur = new Date(startDate);
    cur <= new Date(endDate);
    cur.setDate(cur.getDate() + 1)
  ) {
    const createdAt = moment(cur).format(dateformat);
    if (dailyTopTweets[createdAt]) continue;
    dailyTopTweets[createdAt] = initValue;
  }

  return dailyTopTweets;
};

const convertTweets = async (name, type, tweets) => {
  const urlPrefix = `https://twitter.com/${name}/status/`;
  const promises = tweets.map(async (item) => {
    // const userRetweets = (await retweets(item.id)) || [];
    const entities = item.entities ? item.entities : [];
    return {
      createdAt: moment(item.created_at).format("YYYY-MM-DD HH:mm:ss"),
      url: `${urlPrefix}${item.id}`,
      text: item.text,
      retweets: [],
      entities: entities,
      views: "",
      [`${type}Count`]: item.public_metrics[`${type}_count`],
      metrics: item.public_metrics,
    };
  });

  const statisticsByRetweet = await Promise.all(promises);

  return statisticsByRetweet;
};

const dailyTopTweets = async (startDate, endDate, userId, type) => {
  const today = moment();
  const end = endDate
    ? moment(new Date(endDate)).add(1, "days").toISOString()
    : today.toISOString();
  const start = startDate
    ? moment(new Date(startDate)).subtract(1, "days").toISOString()
    : today.subtract(1, "years").toISOString();

  const { tweets, name } = await userTweetTimelineById(userId, start, end);

  const tweetsData = await convertTweets(name, type, tweets);

  const userTweets = sortByDate(
    "tweets",
    startDate,
    endDate,
    "YYYY-MM-DD",
    tweetsData
  );

  let sortedTweets = {};

  Object.keys(userTweets).map((key) => {
    const data = sortBy[type](userTweets[key], name);
    if (!sortedTweets[key]) {
      sortedTweets[key] = [];
    }
    sortedTweets[key].push(...data);
  });

  return sortedTweets;
};

const dailyTopCounts = async (startDate, endDate, userId, type) => {
  const today = moment();
  const end = endDate
    ? moment(new Date(endDate)).add(1, "days").toISOString()
    : today.toISOString();
  const start = startDate
    ? moment(new Date(startDate)).toISOString()
    : today.subtract(1, "years").toISOString();
  const { tweets, name } = await userTweetTimelineById(userId, start, end);

  const tweetsData = await convertTweets(name, type, tweets);

  const userTweets = sortByDate(
    "counts",
    startDate,
    endDate,
    "YYYY-MM-DD",
    tweetsData
  );

  const tweetCounts = {};
  Object.keys(userTweets).forEach((key) => {
    if (!tweetCounts[key]) {
      tweetCounts[key] = {};
    }

    userTweets[key].forEach((item) => {
      if (!item.metrics) return;
      Object.keys(item.metrics).forEach((metricName) => {
        if (!tweetCounts[key][metricName]) {
          tweetCounts[key][metricName] = 0;
        }

        tweetCounts[key][metricName] += item.metrics[metricName];
      });
    });
  });

  return tweetCounts;
};

const aggregate = async (tweets) => {
  const metrics = {
    retweet_count: 0,
    reply_count: 0,
    like_count: 0,
    quote_count: 0,
  };
  tweets.forEach((data) => {
    const { retweet_count, reply_count, like_count, quote_count } =
      data.public_metrics;

    metrics.retweet_count += retweet_count;
    metrics.reply_count += reply_count;
    metrics.like_count += like_count;
    metrics.quote_count += quote_count;
  });

  return metrics;
};

const totalMetrics = async (startDate, endDate, userId, type) => {
  const today = moment();
  const end = endDate
    ? moment(new Date(endDate)).add(1, "days").toISOString()
    : today.toISOString();
  const start = startDate
    ? moment(new Date(startDate)).toISOString()
    : today.subtract(1, "years").toISOString();
  const { tweets, name } = await userTweetTimelineById(userId, start, end);

  const totalValue = await aggregate(tweets);

  return totalValue;
};

const monthlyTopTweets = async (type) => {
  // * type => retweet, reply, like, quote
};

const monthlyTopCounts = async (type) => {
  // * type => retweet, reply, like, quote
};

const userTweetTimelineById = async (userId, startDate, endDate) => {
  const userTweets = [];
  const url = `${config.twitter.url}/users/${userId}/tweets`;
  const params = {
    start_time: startDate,
    end_time: endDate,
    expansions:
      "attachments.poll_ids,attachments.media_keys,author_id,geo.place_id,in_reply_to_user_id,referenced_tweets.id,entities.mentions.username,referenced_tweets.id.author_id",
    "tweet.fields":
      "attachments,author_id,conversation_id,created_at,entities,geo,id,in_reply_to_user_id,lang,possibly_sensitive,public_metrics,referenced_tweets,reply_settings,source,text,withheld",
    "user.fields":
      "created_at,description,entities,id,location,name,pinned_tweet_id,profile_image_url,protected,public_metrics,url,username,verified,withheld",
    "media.fields":
      "duration_ms,height,media_key,preview_image_url,public_metrics,type,url,width",
    "place.fields":
      "contained_within,country,country_code,full_name,geo,id,name,place_type",
    max_results: 100,
  };

  let hasNextPage = true;
  let nextToken = "";
  let userName = "";

  while (hasNextPage) {
    const res = await getPage(url, params, nextToken);
    if (!res) {
      hasNextPage = false;
      continue;
    }

    userName = res.includes.users[0].username;
    if (res.data) {
      userTweets.push(...res.data);
    }

    if (!res.meta.next_token) {
      hasNextPage = false;
      continue;
    }

    nextToken = res.meta.next_token;
  }

  return { tweets: userTweets, name: userName };
};

module.exports = {
  userTweetTimelineById,
  dailyTopTweets,
  dailyTopCounts,
  followers,
  sortByDate,
  totalMetrics,
};
