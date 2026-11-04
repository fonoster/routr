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
# Regenerates internal/pb from the gRPC contract in mods/common/src/protos. The
# generated code is committed, so a build needs neither protoc nor the plugins.
# Needs protoc and, on PATH, protoc-gen-go v1.36.6 and protoc-gen-go-grpc v1.5.1:
#
#   go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.6
#   go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.5.1
set -e

cd "$(dirname "$0")/.."
protos=../common/src/protos
module=github.com/fonoster/routr/mods/edgeport-go/internal/pb
out=internal/pb

rm -rf "$out"
mkdir -p "$out"

protoc -I "$protos" \
  --go_out="$out" --go_opt=module="$module" \
  --go-grpc_out="$out" --go-grpc_opt=module="$module" \
  --go_opt=Mcommon.proto="$module/common" \
  --go_opt=Msipmessage.proto="$module/sipmessage" \
  --go_opt=Mprocessor.proto="$module/processor" \
  --go-grpc_opt=Mcommon.proto="$module/common" \
  --go-grpc_opt=Msipmessage.proto="$module/sipmessage" \
  --go-grpc_opt=Mprocessor.proto="$module/processor" \
  common.proto sipmessage.proto processor.proto
