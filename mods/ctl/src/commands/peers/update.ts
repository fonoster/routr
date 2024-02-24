/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
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
/* eslint-disable require-jsdoc */
import { CliUx } from "@oclif/core"
import { BaseCommand } from "../../base"
import { CLIError } from "@oclif/core/lib/errors"
import { CommonConnect as CC, CommonTypes as CT } from "@routr/common"
import {
  aorValidator,
  contactAddrValidator,
  maxContactsValidator,
  nameValidator
} from "../../validators"
import SDK from "@routr/sdk"

// NOTE: Newer versions of inquirer have a bug that causes the following error:
// (node:75345) [ERR_REQUIRE_ESM] Error Plugin: @routr/ctl [ERR_REQUIRE_ESM]: require() of ES Module
import inquirer from "inquirer"

export default class UpdatePeerCommand extends BaseCommand {
  static readonly description = "Updates an existing Peer"

  static readonly examples = [
    `<%= config.bin %> <%= command.id %>
Updating Peer Asterisk Conf... 80181ca6-d4aa-4575-9375-8f72b07d5555
`
  ]

  static readonly args = [
    {
      name: "ref",
      required: true,
      description: "reference to an existing Peer"
    }
  ]

  async run(): Promise<void> {
    const { args, flags } = await this.parse(UpdatePeerCommand)
    const { endpoint, insecure, cacert } = flags
    const api = new SDK.Peers({ endpoint, insecure, cacert })

    try {
      const peerFromDB = await api.getPeer(args.ref)

      // TODO: Fix hardcoded pageSize
      const acls = await new SDK.ACL({ endpoint, insecure, cacert }).listACLs({
        pageSize: 25,
        pageToken: ""
      })

      // TODO: Fix hardcoded pageSize
      const credentials = await new SDK.Credentials({
        endpoint,
        insecure,
        cacert
      }).listCredentials({
        pageSize: 25,
        pageToken: ""
      })

      const aclList =
        acls.items?.map((acl: CC.AccessControlList) => {
          return { name: acl.name, value: acl.ref }
        }) || []

      const credentialsList =
        credentials.items?.map((credential: CC.Credentials) => {
          return { name: credential.name, value: credential.ref }
        }) || []

      this.log("This utility will help you update an existing Peer.")
      this.log("Press ^C at any time to quit.")

      const answers = await inquirer.prompt([
        {
          name: "name",
          message: "Friendly Name",
          type: "input",
          default: peerFromDB.name,
          validate: nameValidator
        },
        {
          name: "aor",
          message: "Address of Record",
          type: "input",
          default: peerFromDB.aor,
          validate: aorValidator
        },
        {
          name: "contactAddr",
          message: "Contact Address",
          type: "input",
          default: peerFromDB.contactAddr || undefined,
          validate: contactAddrValidator
        },
        {
          name: "maxContacts",
          message: "Max Contacts",
          type: "input",
          default: peerFromDB.maxContacts === -1 ? "" : peerFromDB.maxContacts,
          validate: maxContactsValidator
        },
        {
          name: "accessControlListRef",
          message: "IP Access Control List",
          choices: [{ name: "None", value: undefined }, ...aclList],
          type: "list",
          default: peerFromDB.accessControlListRef
        },
        {
          name: "credentialsRef",
          message: "Credentials Name",
          choices: [{ name: "None", value: undefined }, ...credentialsList],
          type: "list",
          default: peerFromDB.credentialsRef
        },
        {
          name: "withSessionAffinity",
          message: "Enable Session Affinity?",
          type: "confirm",
          default: peerFromDB.withSessionAffinity
        },
        {
          name: "balancingAlgorithm",
          message: "Balancing Algorithm",
          choices: [
            {
              name: "Round Robin",
              value: CT.LoadBalancingAlgorithm.ROUND_ROBIN
            },
            {
              name: "Least Sessions",
              value: CT.LoadBalancingAlgorithm.LEAST_SESSIONS
            }
          ],
          type: "list",
          default: peerFromDB.balancingAlgorithm
        },
        {
          name: "enabled",
          message: "Enabled?",
          type: "confirm",
          default: peerFromDB.enabled
        },
        {
          name: "confirm",
          message: "Ready?",
          type: "confirm"
        }
      ])
      answers.ref = args.ref

      if (!answers.confirm) {
        this.warn("Aborted")
      } else {
        CliUx.ux.action.start(`Updating Peer ${answers.name}`)

        answers.maxContacts = answers.maxContacts
          ? parseInt(answers.maxContacts)
          : -1

        const acl = await api.updatePeer(answers)
        await CliUx.ux.wait(1000)
        CliUx.ux.action.stop(acl.ref)
      }
    } catch (e) {
      throw new CLIError(e.message)
    }
  }
}
