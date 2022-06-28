#!/usr/bin/env node
import logger from '@fonoster/logger'
import ConnectProcessor from "../mods/connect/src/service"
import SimpleAuthMiddleware from "../mods/simpleauth/src/service"
import SimpleDataService from "../mods/simpledata/src/service"
import MessageDispatcher from "../mods/dispatcher/src/service"
import LocationService from "../mods/location/src/service"
import {getConfig as getDispatcherConfig} from "../mods/dispatcher/src/config/get_config"
import {getConfig as getLocationConfig} from "../mods/location/src/config/get_config"
import {spawn} from "child_process"
import {Helper as H} from "../mods/common"
import {Resource} from '../mods/simpledata/src/types'
import loadResources from '../mods/simpledata/src/utils'

const envcopy = H.deepCopy(process.env);
envcopy.CONFIG_PATH = __dirname + "/../config/edgeport.alt.json";

const edgeport = spawn("./mods/edgeport/edgeport.sh")
const edgeportAlt = spawn("./mods/edgeport/edgeport.sh", {env: envcopy})
const users = require(__dirname + "/../config/auth.json")
const dispatcherConfig = getDispatcherConfig(__dirname + "/../config/dispatcher.json")
const locationConfig = getLocationConfig(__dirname + "/../config/location.json")
const whiteList = process.env.WHITELIST ? process.env.WHITELIST.split(',') : []

logger.info("routr v2 // connect distribution")

if (dispatcherConfig._tag === 'Right') {
  MessageDispatcher(dispatcherConfig.right)
} else {
  logger.error(dispatcherConfig.left)
}

if (locationConfig._tag === 'Right') {
  LocationService(locationConfig.right)
} else {
  logger.error(locationConfig.left)
}

const resources: Resource[] = loadResources(__dirname + "/../mods/simpledata/etc/schemas",
  __dirname + "/../config/resources")

SimpleDataService({bindAddr: "0.0.0.0:52901", resources})
SimpleAuthMiddleware({bindAddr: "0.0.0.0:51903", users, whiteList})
ConnectProcessor({
  bindAddr: "0.0.0.0:51904",
  locationAddr: "localhost:51902",
  apiAddr: "localhost:52901"
})

edgeport.stdout.on("data", (data: any) => {
  process.stdout.write(`${data}`)
});

edgeportAlt.stdout.on("data", (data: any) => {
  process.stdout.write(`${data}`)
});
