const moment = require("moment-timezone");
const util = require("../utils");
const config = require("../config");

const outputGroupItem = (channelName, destinationId, destinationType) => {
  const parameter = {
    OutputGroupSettings: {
      /* required */
      RtmpGroupSettings: {
        AdMarkers: [],
        AuthenticationScheme: "COMMON", // required
        InputLossAction: "EMIT_OUTPUT", // required
      },
    },
    Outputs: [
      /* required */
      {
        OutputSettings: {
          /* required */
          RtmpOutputSettings: {
            Destination: {
              /* required */
              DestinationRefId: destinationId,
            },
          },
        },
        OutputName: util.limitString(
          `${channelName}-${destinationType}-output`,
          32
        ),
        VideoDescriptionName: util.limitString(
          `${channelName}-${destinationType}-video`,
          32
        ),
        AudioDescriptionNames: [
          util.limitString(`${channelName}-${destinationType}-audio`, 32),
        ],
      },
      /* more items */
    ],
    Name: util.limitString(`${channelName}-${destinationType}`, 32),
  };

  return parameter;
};

const rtmpDestinationList = (serviceKeys) => {
  const result = serviceKeys.map((key) => {
    return {
      Id: rtmpDestinationIds[key],
      Settings: [
        {
          Url: `rtmp://1.2.3.4/${channelName}_${key}`,
          StreamName: `${channelName}-${key}`,
        },
      ],
    };
  });

  return result;
};

const rtmpAudioDescriptionList = (serviceKeys) => {
  const result = serviceKeys.map((key) => {
    return {
      AudioSelectorName: `${channelName}-${key}-audio-desc`,
      Name: `${channelName}-${key}-audio`,
      StreamName: `${channelName}-${key}`,
    };
  });

  return result;
};

const rtmpVideoDescriptionList = (serviceKeys) => {
  const result = serviceKeys.map((key) => {
    return {
      Name: util.limitString(`${channelName}-${key}-video`, 32) /* required */,
      Width: width,
      Height: height,
    };
  });

  return result;
};

const channel = (
  channelName,
  channelClass = "SINGLE_PIPELINE",
  input,
  profile,
  logLevel = "ERROR",
  arn = config.medialive.arn
) => {
  const hlsDestinationId = util.randomString(6);
  const frameCaptureDestinationId = util.randomString(5);

  const rtmpServiceKeys = ["youtube", "facebook", "instagram", "rtmp"];
  const rtmpDestinationIds = {};
  rtmpServiceKeys.forEach((key) => {
    rtmpDestinationIds[key] = key;
  });

  const rtmpDestinations = rtmpDestinationList(rtmpServiceKeys);
  const rtmpAudioDescriptions = rtmpAudioDescriptionList(rtmpServiceKeys);
  const rtmpVideoDescriptions = rtmpVideoDescriptionList(rtmpServiceKeys);
  const rtmpOutputGroupItems = rtmpServiceKeys.map((key) => {
    return outputGroupItem(channelName, rtmpDestinationIds[key], key);
  });

  const [width, height] = profile.resolution.split("x");
  const nameModifier = `_${height}p`;

  const destinations = [
    ...rtmpDestinations,
    {
      Id: hlsDestinationId,
      Settings: [
        {
          Url: `${config.s3.uri}/channel/${channelName}/${channelName}.m3u8`,
        },
      ],
    },
    {
      Id: frameCaptureDestinationId,
      Settings: [
        {
          Url: `${config.s3.uri}/channel/${channelName}/${channelName}.png`,
        },
      ],
    },
  ];

  const params = {
    ChannelClass: channelClass,
    Destinations: destinations,
    EncoderSettings: {
      AudioDescriptions: [
        /* required */
        ...rtmpAudioDescriptions,
        {
          AudioSelectorName: `${channelName}-hls-audio-selector` /* required */,
          Name: `${channelName}-hls-audio` /* required */,
        },
        /* more items */
      ],
      OutputGroups: [
        /* required */
        ...rtmpOutputGroupItems,
        // HLS output parameters
        {
          OutputGroupSettings: {
            /* required */
            HlsGroupSettings: {
              AdMarkers: [],
              Destination: {
                DestinationRefId: hlsDestinationId,
              },
              HlsCdnSettings: {
                HlsS3Settings: {
                  // AUTHENTICATED_READ | BUCKET_OWNER_FULL_CONTROL | BUCKET_OWNER_READ | PUBLIC_READ
                  CannedAcl: "PUBLIC_READ",
                },
              },
            },
          },
          Outputs: [
            /* required */
            {
              OutputSettings: {
                /* required */
                HlsOutputSettings: {
                  NameModifier: nameModifier,
                  HlsSettings: {
                    StandardHlsSettings: {
                      M3u8Settings: {
                        AudioFramesPerPes: "4",
                        AudioPids: "492-498",
                        PcrControl: "PCR_EVERY_PES_PACKET",
                        Scte35Pid: "500",
                        TimedMetadataPid: "502",
                        VideoPid: "481",
                        PmtPid: "480",
                      },
                    },
                  },
                },
              },
              OutputName: `${channelName}-hls-output`,
              VideoDescriptionName: `${channelName}-hls-video`,
              AudioDescriptionNames: [`${channelName}-hls-audio`],
            },
            /* more items */
          ],
          Name: `${channelName}-hls`,
        },
        // FrameCapture output parameters
        {
          OutputGroupSettings: {
            FrameCaptureGroupSettings: {
              Destination: {
                DestinationRefId: frameCaptureDestinationId /* required */,
              },
              FrameCaptureCdnSettings: {
                FrameCaptureS3Settings: {
                  CannedAcl: "PUBLIC_READ",
                },
              },
            },
          },
          Outputs: [
            {
              OutputSettings: {
                FrameCaptureOutputSettings: {
                  NameModifier: nameModifier,
                },
              },
              OutputName: `${channelName}-frame-capture-output`,
              VideoDescriptionName: `${channelName}-frame-capture-video-desc`,
              AudioDescriptionNames: [],
            },
          ],
        },
        /* more items */
      ],
      TimecodeConfig: {
        // EMBEDDED | SYSTEMCLOCK | ZEROBASED
        Source: "EMBEDDED", // default
      },
      VideoDescriptions: [
        ...rtmpVideoDescriptions,
        {
          Name: `${channelName}-hls-video` /* required */,
          Width: width,
          Height: height,
          Sharpness: 50,
        },
        {
          Name: `${channelName}-frame-capture-video-desc`,
          CodecSettings: {
            FrameCaptureSettings: {
              CaptureInterval: 5,
              CaptureIntervalUnits: "SECONDS",
            },
          },
          Width: 1920,
          Height: 1080,
          Sharpness: 50,
          RespondToAfd: "NONE",
          ScalingBehavior: "DEFAULT",
        },
        /* more items */
      ],
    },
    InputAttachments: input,
    LogLevel: logLevel,
    Name: channelName,
    RoleArn: arn,
  };

  return params;
};

const scheduleAction = (
  actionName,
  scheduleType,
  inputReferenceName,
  urlPath,
  followSettings = {},
  time = moment().utc()
) => {
  const schedule = {
    ActionName: actionName,
    ScheduleActionSettings: {
      InputSwitchSettings: {
        InputAttachmentNameReference: inputReferenceName,
        UrlPath: urlPath ? [urlPath] : [],
      },
    },
    ScheduleActionStartSettings: {},
  };

  switch (scheduleType) {
    case "fixed":
      schedule.ScheduleActionStartSettings = {
        FixedModeScheduleActionStartSettings: {
          Time: util.isISOString(time) ? time : time.toISOString(),
        },
      };
      return schedule;
    case "follow":
      const { followPoint, referenceActionName } = followSettings;

      schedule.ScheduleActionStartSettings = {
        FollowModeScheduleActionStartSettings: {
          FollowPoint: followPoint,
          ReferenceActionName: referenceActionName,
        },
      };
      return schedule;
    case "immediate":
      schedule.ScheduleActionStartSettings = {
        ImmediateModeScheduleActionStartSettings: {},
      };
      return schedule;
    default:
      return schedule;
  }
};

const batchUpdateSchedule = (channelId, scheduleActions, deleteActions) => {
  const params = {
    /* required */
    ChannelId: channelId,
    Creates: {
      ScheduleActions: scheduleActions,
    },
    Deletes: {
      ActionNames: deleteActions,
    },
  };

  return params;
};

const input = (channelName, name, type, sources) => {
  switch (type) {
    case "RTMP_PUSH":
      return {
        Name: name,
        Type: type,
        Destinations: [
          {
            StreamName: channelName,
          },
        ],
        // medialive input security group 설정
        InputSecurityGroups: [config.medialive.input.security],
      };
    default:
      return {
        Name: name,
        Type: type,
        Sources: sources.map((item) => {
          return {
            Url: item.url,
          };
        }),
      };
  }
};

const initializeInputs = (
  type,
  channelName,
  streamUrl = "rtmp://1.2.3.4/temp"
) => {
  // Type: UDP_PUSH | RTP_PUSH | RTMP_PUSH | RTMP_PULL | URL_PULL | MP4_FILE
  const items = [];

  const defaultVideo = {
    name: `${channelName}-default`,
    type: "MP4_FILE",
    url: `s3://${config.s3.bucket}/media/common/default.mp4`,
  };
  const dynamicInput = {
    name: `${channelName}-dynamic`,
    type: "MP4_FILE",
    url: "s3://$urlPath$",
  };
  const rtmpPush = {
    name: `${channelName}-rtmp-push`,
    type: "RTMP_PUSH",
    url: "",
  };
  const rtmpPull = {
    name: `${channelName}-rtmp-pull`,
    type: "RTMP_PULL",
    url: streamUrl,
  };

  switch (type) {
    case "pull":
      items.push(...[rtmpPull, rtmpPush, dynamicInput]);
      break;
    case "push":
      items.push(...[rtmpPush, dynamicInput, rtmpPull]);
      break;
    case "linear":
      items.push(...[defaultVideo, rtmpPush, dynamicInput, rtmpPull]);
      break;
  }

  const params = items.map((item) => {
    const sources = [
      {
        url: item.url,
      },
    ];

    return input(channelName, item.name, item.type, sources);
  });

  return params;
};

const frameCaptureOutputGroupSettings = (
  channelName,
  channelId,
  destinationId
) => {
  const params = {
    ChannelId: channelId,
    Destination: {
      DestinationRefId: destinationId,
    },
    OutputGroupSettings: {
      FrameCaptureOutputGroupSettings: {
        Destination: {
          DestinationRefId: destinationId,
        },
        DestinationSettings: {
          S3Settings: {
            // AUTHENTICATED_READ | BUCKET_OWNER_FULL_CONTROL | BUCKET_OWNER_READ | PUBLIC_READ
            CannedAcl: "PUBLIC_READ",
          },
        },
      },
    },
    Outputs: [
      {
        OutputSettings: {
          FrameCaptureOutputSettings: {
            NameModifier: `${channelName}-`,
          },
        },
        OutputName: `${channelName}-output`,
      },
    ],
    Name: `${channelName}-output`,
  };

  return params;
};

/**
 * rtmp-push 방식의 채널 파라미터
 * @param {*} channelName
 * @param {*} channelClass
 * @param {*} input
 * @param {*} destinations
 * @param {*} logLevel INFO | WARNING | ERROR | DEBUG
 * @param {*} arn
 * @returns object
 */
const RtmpPush = (
  channelName,
  channelClass = "SINGLE_PIPELINE",
  input,
  profile,
  logLevel = "ERROR",
  arn = config.medialive.arn
) => {
  const destinationId = util.randomString(6);
  const frameCaptureDestinationId = util.randomString(5);
  const [width, height] = profile.resolution.split("x");
  const nameModifier = `_${height}p`;

  const destinations = [
    {
      Id: destinationId,
      Settings: [
        {
          Url: `rtmp://1.2.3.4/${channelName}`,
          StreamName: channelName,
        },
      ],
    },
    {
      Id: frameCaptureDestinationId,
      Settings: [
        {
          Url: `${config.s3.uri}/channel/${channelName}/${channelName}.png`,
        },
      ],
    },
  ];
  const params = {
    ChannelClass: channelClass,
    Destinations: destinations,
    EncoderSettings: {
      AudioDescriptions: [
        /* required */
        {
          AudioSelectorName: util.limitString(
            `${channelName}-audio-desc`,
            32
          ) /* required */,
          Name: util.limitString(`${channelName}-audio`, 32) /* required */,
          StreamName: `${channelName}-stream`,
        },
        /* more items */
      ],
      OutputGroups: [
        /* required */
        {
          OutputGroupSettings: {
            /* required */
            RtmpGroupSettings: {
              AdMarkers: [],
              AuthenticationScheme: "COMMON", // required
              InputLossAction: "EMIT_OUTPUT", // required
            },
          },
          Outputs: [
            /* required */
            {
              OutputSettings: {
                /* required */
                RtmpOutputSettings: {
                  Destination: {
                    /* required */
                    DestinationRefId: destinationId,
                  },
                },
              },
              OutputName: util.limitString(`${channelName}-output`, 32),
              VideoDescriptionName: util.limitString(
                `${channelName}-video-desc`,
                32
              ),
              AudioDescriptionNames: [
                util.limitString(`${channelName}-audio`, 32),
              ],
            },
            /* more items */
          ],
          Name: util.limitString(`${channelName}-output-group`, 32),
        },
        {
          OutputGroupSettings: {
            FrameCaptureGroupSettings: {
              Destination: {
                /* required */ DestinationRefId: frameCaptureDestinationId,
              },
              FrameCaptureCdnSettings: {
                FrameCaptureS3Settings: {
                  CannedAcl: "PUBLIC_READ",
                },
              },
            },
          },
          Outputs: [
            {
              OutputSettings: {
                FrameCaptureOutputSettings: {
                  NameModifier: nameModifier,
                },
              },
              OutputName: `${channelName}-frame-capture-output`,
              VideoDescriptionName: `${channelName}-frame-capture-video-desc`,
              AudioDescriptionNames: [],
            },
          ],
        },
        /* more items */
      ],
      TimecodeConfig: {
        // EMBEDDED | SYSTEMCLOCK | ZEROBASED
        Source: "EMBEDDED", // default
      },
      VideoDescriptions: [
        /* required */
        {
          Name: util.limitString(
            `${channelName}-video-desc`,
            32
          ) /* required */,
          Width: width,
          Height: height,
        },
        {
          Name: `${channelName}-frame-capture-video-desc`,
          CodecSettings: {
            FrameCaptureSettings: {
              CaptureInterval: 5,
              CaptureIntervalUnits: "SECONDS",
            },
          },
          Width: 1920,
          Height: 1080,
          Sharpness: 50,
          RespondToAfd: "NONE",
          ScalingBehavior: "DEFAULT",
        },
        /* more items */
      ],
    },
    InputAttachments: input,
    LogLevel: logLevel,
    Name: channelName,
    RoleArn: arn,
  };

  return params;
};

/**
 * HLS S3 방식의 채널 파라미터
 * @param {*} channelName
 * @param {*} channelClass
 * @param {*} input
 * @param {*} destinations
 * @param {*} logLevel
 * @param {*} arn
 * @returns object
 */
const HlsS3 = (
  channelName,
  channelClass = "SINGLE_PIPELINE",
  input,
  profile,
  logLevel = "ERROR",
  arn = config.medialive.arn
) => {
  const destinationId = "kywofs";
  const frameCaptureDestinationId = util.randomString(5);
  const [width, height] = profile.resolution.split("x");
  const nameModifier = `_${height}p`;
  const destination = [
    {
      Id: destinationId,
      Settings: [
        {
          Url: `${config.s3.uri}/channel/${channelName}/${channelName}.m3u8`,
        },
      ],
    },
    {
      Id: frameCaptureDestinationId,
      Settings: [
        {
          Url: `${config.s3.uri}/channel/${channelName}/${channelName}.png`,
        },
      ],
    },
  ];

  const params = {
    ChannelClass: channelClass,
    Destinations: destination,
    EncoderSettings: {
      AudioDescriptions: [
        /* required */
        {
          AudioSelectorName: `${channelName}-audio-selector` /* required */,
          Name: `${channelName}-audio` /* required */,
          // StreamName: `test-stream`,
        },
        /* more items */
      ],
      OutputGroups: [
        /* required */
        {
          OutputGroupSettings: {
            /* required */
            HlsGroupSettings: {
              AdMarkers: [],
              Destination: {
                DestinationRefId: destinationId,
              },
              HlsCdnSettings: {
                HlsS3Settings: {
                  // AUTHENTICATED_READ | BUCKET_OWNER_FULL_CONTROL | BUCKET_OWNER_READ | PUBLIC_READ
                  CannedAcl: "PUBLIC_READ",
                },
              },
            },
          },
          Outputs: [
            /* required */
            {
              OutputSettings: {
                /* required */
                HlsOutputSettings: {
                  NameModifier: nameModifier,
                  HlsSettings: {
                    StandardHlsSettings: {
                      M3u8Settings: {
                        AudioFramesPerPes: "4",
                        AudioPids: "492-498",
                        PcrControl: "PCR_EVERY_PES_PACKET",
                        Scte35Pid: "500",
                        TimedMetadataPid: "502",
                        VideoPid: "481",
                        PmtPid: "480",
                      },
                    },
                  },
                },
              },
              OutputName: `${channelName}-hls-s3-output`,
              VideoDescriptionName: `${channelName}-video-description`,
              AudioDescriptionNames: [`${channelName}-audio`],
            },
            /* more items */
          ],
          Name: `${channelName}-output`,
        },
        {
          OutputGroupSettings: {
            FrameCaptureGroupSettings: {
              Destination: {
                /* required */ DestinationRefId: frameCaptureDestinationId,
              },
              FrameCaptureCdnSettings: {
                FrameCaptureS3Settings: {
                  CannedAcl: "PUBLIC_READ",
                },
              },
            },
          },
          Outputs: [
            {
              OutputSettings: {
                FrameCaptureOutputSettings: {
                  NameModifier: nameModifier,
                },
              },
              OutputName: `${channelName}-frame-capture-output`,
              VideoDescriptionName: `${channelName}-frame-capture-video-description`,
              AudioDescriptionNames: [],
            },
          ],
        },
        /* more items */
      ],
      TimecodeConfig: {
        // EMBEDDED | SYSTEMCLOCK | ZEROBASED
        Source: "EMBEDDED", // default
      },
      VideoDescriptions: [
        /* required */
        {
          Name: `${channelName}-video-description` /* required */,
          Width: width,
          Height: height,
          Sharpness: 50,
        },
        {
          Name: `${channelName}-frame-capture-video-description`,
          CodecSettings: {
            FrameCaptureSettings: {
              CaptureInterval: 5,
              CaptureIntervalUnits: "SECONDS",
            },
          },
          Width: 1920,
          Height: 1080,
          Sharpness: 50,
          RespondToAfd: "NONE",
          ScalingBehavior: "DEFAULT",
        },
        /* more items */
      ],
    },
    InputAttachments: input,
    LogLevel: logLevel,
    Name: channelName,
    RoleArn: arn,
  };

  return params;
};

module.exports = {
  channel,
  RtmpPush,
  HlsS3,
  initializeInputs,
  input,
  scheduleAction,
  batchUpdateSchedule,
};
