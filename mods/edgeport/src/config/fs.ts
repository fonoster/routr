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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Java: any
import * as yaml from "js-yaml"
import * as toml from "toml"
import { JsonObject } from "pb-util/build"

const JFile = Java.type("java.io.File")
const Files = Java.type("java.nio.file.Files")
const Paths = Java.type("java.nio.file.Paths")

export const readFile = (path: string) => {
  const lines = Files.readAllLines(
    Paths.get(path),
    Java.type("java.nio.charset.StandardCharsets").UTF_8
  )
  const data: string[] = []
  lines.forEach((line: string) => {
    data.push(line)
  })
  return data.join("\n").trim()
}

export const exists = (path: string) => new JFile(path).exists()

export const isFile = (path: string) => new JFile(path).isFile()

/**
 * Reads a file and returns a JSON object or throws an error.
 * The file must be a valid JSON, YAML, or TOML file.
 *
 * @param {string} path - The path to the file
 * @return {object} The JSON object
 * @throws {Error} If the file is not a valid JSON, YAML, or TOML file
 * @throws {Error} If the file does not exist
 * @throws {Error} If the file is not readable
 * @throws {Error} If the file is empty
 */
export const readConfigFile = (path: string): JsonObject => {
  if (!exists(path) || !isFile(path)) {
    throw new Error(`config file ${path} does not exist`)
  }

  const content = readFile(path)

  try {
    return yaml.load(content) as JsonObject
  } catch (e) {
    // no-op
  }

  // Experimental TOML support
  try {
    return toml.parse(content)
  } catch (e) {
    // no-op
  }

  try {
    return JSON.parse(content)
  } catch (e) {
    throw new Error("file is not a valid JSON or YAML file")
  }
}
