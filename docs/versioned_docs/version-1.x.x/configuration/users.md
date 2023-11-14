# Users

Users exist in Routr to perform administrative actions on a Routr instance.
The Users configuration can be provided using the file `config/users.yml` located at the root of your Routr installation.

> If using Redis this configuration gets stored in the database.

## User Resource

| Property | Description | Required |
| --- | --- | --- |
| apiVersion | Indicates the version of the resource (Not yet implemented)| Yes |
| kind | Defines the type of resource | Yes |
| metadata.name | Friendly name for the User device | Yes |
| spec.credentials.username | User's credential username | Yes |
| spec.credentials.secret | User's credential secret | Yes |

## Example

```yaml
- apiVersion: v1beta1
  kind: User
  metadata:
    name: Administrator
  spec:
    credentials:
      username: admin
      secret: changeit
```

## Changing the password? (Redis)

First, run the command `redis-cli smembers users` to obtain the reference to the user. Here is an example:

```
$ redis-cli smembers users
1) "5aa69ead8fd6861d92385bac"
```
Then, retrieve the document for reference running `redis-cli get {REF}`. For example

```
$ redis-cli get 5aa69ead8fd6861d92385bac
"{\"apiVersion\":\"v1beta1\",\"kind\":\"User\",\"metadata\":{\"name\":\"Ctl\",\"ref\":\"5aa69ead8fd6861d92385bac\"},\"spec\":{\"credentials\":{\"username\":\"admin\",\"secret\":\"oldpass\"}}}"
```

Finally, search and change the old password and update your document using `redis-cli set {REF} {DOCUMENT}`. Like this:

```
$ redis-cli set 5aa69ead8fd6861d92385bac
"{\"apiVersion\":\"v1beta1\",\"kind\":\"User\",\"metadata\":{\"name\":\"Ctl\",\"ref\":\"5aa69ead8fd6861d92385bac\"},\"spec\":{\"credentials\":{\"username\":\"admin\",\"secret\":\"newpass\"}}}"
```

> A new token is issued after your next login with `rctl`
