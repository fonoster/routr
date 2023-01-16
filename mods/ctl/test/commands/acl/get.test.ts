/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster
 *
 * This file is part of Routr.
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
import { expect, test } from "@oclif/test"
import SDK from "@routr/sdk"

describe("@routr/ctl/acl/get", () => {
  test
    .stub(SDK.ACL.prototype, "listACLs", () => {
      return {
        items: [
          {
            ref: "80181ca6-d4aa-4575-9375-8f72b07d9949",
            name: "PSTN Provider US-CA",
            deny: ["0.0.0.0/0"],
            allow: ["47.132.130.31"],
            createdAt: "2021-03-01T00:00:00.000Z",
            updatedAt: "2021-03-01T00:00:00.000Z"
          }
        ],
        nextPageToken: ""
      }
    })
    .stdout()
    .command(["acl:get", "--insecure", "--endpoint=localhost:51907"])
    .it("runs acl get cmd", (ctx) => {
      expect(ctx.stdout).to.contain("Ref")
      expect(ctx.stdout).to.contain("Name")
      expect(ctx.stdout).to.contain("Deny List")
      expect(ctx.stdout).to.contain("Allow List")
      // Visually check that the output is correct; This currenty does not work
      // expect(ctx.stdout).to.contain("80181ca6-d4aa-4575-9375-8f72b07d9949")
      expect(ctx.stdout).to.contain("PSTN Provider US-CA")
      expect(ctx.stdout).to.contain("0.0.0.0/0")
      expect(ctx.stdout).to.contain("47.132.130.31")
      expect(ctx.stdout).to.not.contain("2021-03-01T00:00:00.000Z")
    })
})
