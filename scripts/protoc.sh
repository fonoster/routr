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
# Regenerates both generated trees from protos/, in one run:
#
#   internal/common/pb   module path github.com/fonoster/routr/internal/common/pb: every
#                        proto, for the root module (cmd/, internal/)
#   pkg/processor/pb     module path github.com/fonoster/routr/pkg/processor/pb: common,
#                        sipmessage, processor and location, for the Go processor SDK, a
#                        module of its own that shares nothing with the root one
#
# The generated code is committed and never edited, so a build needs neither protoc nor
# the plugins. Needs protoc 29.3 and, on PATH, protoc-gen-go v1.36.6 and
# protoc-gen-go-grpc v1.5.1:
#
#   go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.6
#   go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.5.1
set -e

cd "$(dirname "$0")/.."
protos=protos

# generate <module> <out> <core protos> <connect protos>: every proto maps to its own Go
# package under <out>; the Connect resources under <out>/connect.
generate() {
  module=$1
  out=$2
  core=$3
  connect=$4

  rm -rf "$out"
  mkdir -p "$out"

  opts=""
  files=""
  for p in $core; do
    opts="$opts --go_opt=M$p.proto=$module/$p --go-grpc_opt=M$p.proto=$module/$p"
    files="$files $p.proto"
  done
  for p in $connect; do
    opts="$opts --go_opt=M$p.proto=$module/connect/$p --go-grpc_opt=M$p.proto=$module/connect/$p"
    files="$files $p.proto"
  done

  # shellcheck disable=SC2086
  protoc -I "$protos" -I "$protos/connect" \
    --go_out="$out" --go_opt=module="$module" \
    --go-grpc_out="$out" --go-grpc_opt=module="$module" \
    $opts $files
}

# The root module's stubs: every contract.
internal_pb() {
  generate github.com/fonoster/routr/internal/common/pb internal/common/pb \
    "common sipmessage processor location requester verifier" \
    "acl credentials trace numbers agents domains peers trunks"
}

# The Go processor SDK's stubs: the four protos a processor needs (location because a
# routing processor calls FindRoutes and the alterations take its Route).
sdk_pb() {
  generate github.com/fonoster/routr/pkg/processor/pb pkg/processor/pb \
    "common sipmessage processor location" ""
}

internal_pb
sdk_pb
