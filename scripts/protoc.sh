#!/bin/sh
#
# Copyright (C) 2026 by Fonoster Inc (https://fonoster.com)
# http://github.com/fonoster/routr
#
# This file is part of Routr.
#
# Licensed under the MIT License (the "License");
# you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
#
#    https://opensource.org/licenses/MIT
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# Regenerates internal/common/pb from protos/. The generated code is committed, so a
# build needs neither protoc nor the plugins.
# Needs protoc and, on PATH, protoc-gen-go v1.36.6 and protoc-gen-go-grpc v1.5.1:
#
#   go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.6
#   go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.5.1
set -e

cd "$(dirname "$0")/.."
protos=protos
module=github.com/fonoster/routr/internal/common/pb
out=internal/common/pb

rm -rf "$out"
mkdir -p "$out"

# Every proto maps to its own Go package under internal/common/pb; the Connect
# resources under internal/common/pb/connect.
core="common sipmessage processor location requester verifier"
connect="acl credentials trace numbers agents domains peers trunks"

opts=""
for p in $core; do
  opts="$opts --go_opt=M$p.proto=$module/$p --go-grpc_opt=M$p.proto=$module/$p"
done
for p in $connect; do
  opts="$opts --go_opt=M$p.proto=$module/connect/$p --go-grpc_opt=M$p.proto=$module/connect/$p"
done

files=""
for p in $core; do files="$files $p.proto"; done
for p in $connect; do files="$files $p.proto"; done

# shellcheck disable=SC2086
protoc -I "$protos" -I "$protos/connect" \
  --go_out="$out" --go_opt=module="$module" \
  --go-grpc_out="$out" --go-grpc_opt=module="$module" \
  $opts $files
