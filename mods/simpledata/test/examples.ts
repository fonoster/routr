import { Resource } from "../src/types"

export const resources: Resource[] = [
  {
    "apiVersion": "v2draft1",
    "kind": "Credential",
    "metadata": {
      "ref": "crd2c76ft",
      "name": "my-secret-credential"
    },
    "spec": {
      "credentials": {
        "username": "username",
        "password": "password"
      }
    }
  },
  {
    "apiVersion": "v2draft1",
    "kind": "AccessControlList",
    "metadata": {
      "ref": "acl2c77f4",
      "name": "Europe ACL"
    },
    "spec": {
      "accessControlList": {
        "deny": [
          "0.0.0.0/1"
        ],
        "allow": [
          "192.168.0.1/31"
        ]
      }
    }
  }
]