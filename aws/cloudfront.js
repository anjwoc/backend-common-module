const AWS = require("aws-sdk");
const cloudfront = new AWS.CloudFront({ region: "ap-northeast-2" });

const listDistributions = async (parameters) => {
  const distributions = cloudfront.listDistributions(parameters).promise();

  return distributions;
};

const createDistribution = async (parameters) => {
  const distribution = cloudfront.createDistribution(parameters).promise();

  return distribution;
};

const getDistribution = async (parameters) => {
  const description = cloudfront.getDistribution(parameters).promise();

  return description;
};

module.exports = {
  listDistributions,
  createDistribution,
  getDistribution,
};
