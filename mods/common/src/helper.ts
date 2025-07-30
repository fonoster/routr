/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr
 *
 * Licensed under the MIT License (the "License");
 * you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 *
 *    https://opensource.org/licenses/MIT
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as yaml from "js-yaml"
import * as toml from "toml"
import fs from "fs"
import { NetInterface, Transport } from "./types"

/**
 * Makes a deep copy of an object.
 *
 * @param {object} source - The source object.
 * @return {object} The deep copy of the source object.
 */
export const deepCopy = <T>(source: T): T => {
  if (Array.isArray(source)) {
    // Type assertion: we know the output is T if input is T
    return source.map((item) => deepCopy(item)) as unknown as T
  } else if (source instanceof Date) {
    return new Date(source.getTime()) as unknown as T
  } else if (source && typeof source === "object") {
    return Object.getOwnPropertyNames(source).reduce((o, prop) => {
      Object.defineProperty(
        o,
        prop,
        Object.getOwnPropertyDescriptor(source, prop)
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      o[prop] = deepCopy((source as { [key: string]: any })[prop])
      return o
    }, Object.create(Object.getPrototypeOf(source)))
  } else {
    return source as T
  }
}

/**
 * Gets a listening point from a request.
 *
 * @param {NetInterface[]} listeningPoints - The listening points.
 * @param {Transport} transport - The transport.
 * @return {NetInterface} transport The deep copy of the source object.
 */
export const getListeningPoint = (
  listeningPoints: NetInterface[],
  transport: Transport
) => {
  const listeningPoint = transport
    ? listeningPoints.find(
        (lp) => lp.transport.toUpperCase() === transport.toUpperCase()
      )
    : listeningPoints.find((lp) => lp.transport.toUpperCase() === Transport.UDP)

  if (!listeningPoint) {
    throw new Error(`no listening point found for transport ${transport}`)
  }

  return listeningPoint
}

/**
 * Reads a file and returns a JSON object or throws an error.
 * The file must be a valid JSON, YAML, or TOML file.
 *
 * @param {string} path - The path to the file.
 * @return {object} The JSON object.
 * @throws {Error} If the file is not a valid JSON, YAML, or TOML file.
 * @throws {Error} If the file does not exist.
 * @throws {Error} If the file is not readable.
 * @throws {Error} If the file is empty.
 */
export const readConfigFile = (path: string): Record<string, any> => {
  if (!fs.existsSync(path) || !fs.statSync(path).isFile()) {
    throw new Error(`config file ${path} does not exist`)
  }

  const content = fs.readFileSync(path, "utf8")

  try {
    return yaml.load(content)
  } catch (e) {
    // Ignore
  }

  // Experimental TOML support
  try {
    return toml.parse(content)
  } catch (e) {
    // Ignore
  }

  try {
    return JSON.parse(content)
  } catch (e) {
    throw new Error("file is not a valid JSON or YAML file")
  }
}

export const toPascalCase = (str: string): string => {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => {
      return word.toUpperCase()
    })
    .replace(/\s+/g, "")
}
