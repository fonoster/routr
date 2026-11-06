/*
 * Copyright (C) 2026 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
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

// Package data is the Data API (ROUTR3.md § 3.4): the seven Connect gRPC
// services (ACLs, Agents, Credentials, Domains, Numbers, Peers and Trunks)
// served from one of two backends behind the Store interface. The files
// backend ports @routr/simpledata (mods/simpledata); the postgres backend
// ports @routr/pgdata (mods/pgdata on main) on the Routr 2 schema. In
// milestone 1 the API serves reads only: Get, List and FindBy. Writes answer
// Unimplemented until milestone 2.
package data

import (
	"context"
	"fmt"
	"log/slog"

	"google.golang.org/grpc"
	"google.golang.org/protobuf/proto"

	"github.com/fonoster/routr/internal/common/pb/connect/acl"
	"github.com/fonoster/routr/internal/common/pb/connect/agents"
	"github.com/fonoster/routr/internal/common/pb/connect/credentials"
	"github.com/fonoster/routr/internal/common/pb/connect/domains"
	"github.com/fonoster/routr/internal/common/pb/connect/numbers"
	"github.com/fonoster/routr/internal/common/pb/connect/peers"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
)

// Kind is one of the seven Connect resource kinds, spelled as @routr/common
// spells them (CommonConnect.Kind).
type Kind string

// The Connect resource kinds
const (
	KindAgent       Kind = "agent"
	KindPeer        Kind = "peer"
	KindNumber      Kind = "number"
	KindTrunk       Kind = "trunk"
	KindDomain      Kind = "domain"
	KindCredentials Kind = "credentials"
	KindACL         Kind = "accesscontrollist"
)

// Kinds lists every kind the Data API serves, in the order simpledata
// registers them.
var Kinds = []Kind{
	KindAgent, KindACL, KindCredentials, KindNumber, KindTrunk, KindPeer, KindDomain,
}

// Page is a List request: pageSize <= 0 means no limit (the Node services
// read an absent int32 as undefined, which Prisma treats as no take) and an
// empty pageToken starts from the first item. The token is the ref of the
// last item of the previous page, as pgdata's list returns it.
type Page struct {
	Size  int32
	Token string
}

// Store is what a backend implements: reads of one kind at a time, answered
// as the generated protobuf messages so the gRPC layer serializes exactly
// what the Node services serialized. The message type per kind is
// MessageOf(kind). A failed lookup is a NotFoundError and a bad request a
// BadRequestError; any other error reaches the client as Unknown with its
// message, as the Node services' uncaught errors did. FindBy on a field the
// kind has no column for is such an error for the postgres backend (Prisma
// rejected the where clause) and an empty list for files, as each Node
// service answered.
type Store interface {
	// Get returns the resource with that ref, with the nested resources
	// its kind embeds.
	Get(ctx context.Context, kind Kind, ref string) (proto.Message, error)
	// FindBy returns every resource of the kind whose field equals value.
	FindBy(ctx context.Context, kind Kind, field, value string) ([]proto.Message, error)
	// List returns one page of the kind, newest first.
	List(ctx context.Context, kind Kind, page Page) ([]proto.Message, error)
	// Close releases the backend's resources.
	Close() error
}

// Cipher decrypts the fields Routr 2 stored encrypted (Credentials.password,
// through prisma-field-encryption, in cloak's v1.aesgcm256 format). The
// config slice builds the real one from spec.data.encryptionKey and RoutrOne
// wires it; Identity is the default.
type Cipher interface {
	Decrypt(ciphertext string) (string, error)
}

// Identity is the Cipher of a database with no encryption key: values are
// stored and served in clear.
type Identity struct{}

// Decrypt returns the value as stored.
func (Identity) Decrypt(value string) (string, error) { return value, nil }

// MessageOf returns a new, empty message of the kind, or nil for an unknown
// kind.
func MessageOf(kind Kind) proto.Message {
	switch kind {
	case KindAgent:
		return &agents.Agent{}
	case KindPeer:
		return &peers.Peer{}
	case KindNumber:
		return &numbers.Number{}
	case KindTrunk:
		return &trunks.Trunk{}
	case KindDomain:
		return &domains.Domain{}
	case KindCredentials:
		return &credentials.Credentials{}
	case KindACL:
		return &acl.AccessControlList{}
	}
	return nil
}

// Options tunes a Data API.
type Options struct {
	// Logger receives the structured log; nil means slog.Default()
	Logger *slog.Logger
}

// Data is the Data API component: a Store served as the seven Connect gRPC
// services.
type Data struct {
	store Store
	log   *slog.Logger
}

// New builds the Data API over a Store.
func New(store Store, opts Options) (*Data, error) {
	if store == nil {
		return nil, fmt.Errorf("data: a store is required")
	}
	log := opts.Logger
	if log == nil {
		log = slog.Default()
	}
	return &Data{store: store, log: log}, nil
}

// Register adds the seven Connect services to a gRPC server.
func (d *Data) Register(s grpc.ServiceRegistrar) {
	acl.RegisterACLServiceServer(s, &aclServer{d: d})
	agents.RegisterAgentsServer(s, &agentsServer{d: d})
	credentials.RegisterCredentialsServiceServer(s, &credentialsServer{d: d})
	domains.RegisterDomainsServer(s, &domainsServer{d: d})
	numbers.RegisterNumbersServer(s, &numbersServer{d: d})
	peers.RegisterPeersServer(s, &peersServer{d: d})
	trunks.RegisterTrunksServer(s, &trunksServer{d: d})
}

// Close closes the Store.
func (d *Data) Close() error { return d.store.Close() }
