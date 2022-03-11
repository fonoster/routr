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
import chai from 'chai'
import sinon from 'sinon'
import sinonChai from 'sinon-chai'
import { getObjectProto } from '../src/service'

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox();

const objectProto = {
  name: "processor",
  version: "v2draft1",
  path: __dirname + '/../src/protos/processor.proto'
}

describe('@routr/common', () => {
  afterEach(() => sandbox.restore());

  it('gets Processor object proto', () => {
    expect(getObjectProto(objectProto))
      .to.have.property("Processor").to.have.property("service")
  })

  it('fails to gets object proto due to a typo', () => {
    const objectProto2 = {...objectProto}
    // Introduce a typo
    objectProto2.name = "processo"
    expect(getObjectProto(objectProto2).toString())
      .to.include("Service definition for processo/v2draft1 not found")
  })
})
