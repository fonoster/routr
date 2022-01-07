/*
 * Copyright (C) 2021 by Fonoster Inc (https://fonoster.com)
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
declare const Java: any

const BufferedWriter = Java.type('java.io.BufferedWriter')
const JFile = Java.type('java.io.File')
const Files = Java.type('java.nio.file.Files')
const FileWriter = Java.type('java.io.FileWriter')
const Paths = Java.type('java.nio.file.Paths')

export const readFile = (path: string) => {
  const lines = Files.readAllLines(
    Paths.get(path),
    Java.type('java.nio.charset.StandardCharsets').UTF_8
  )
  const data: any = []
  lines.forEach((line: string) => {
    data.push(line)
  })
  return data.join('\n').trim()
}

export const writeFile = (path: string, text: string) => {
  const file = new JFile(path)
  const out = new BufferedWriter(new FileWriter(file))
  out.write(text)
  out.close()
}