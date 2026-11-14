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
package connect

import (
	"strconv"
	"strings"

	"github.com/nyaruka/phonenumbers"

	"github.com/fonoster/routr/internal/common/numbering"
	"github.com/fonoster/routr/internal/common/pb/connect/numbers"
	"github.com/fonoster/routr/internal/common/pb/connect/trunks"
	ppb "github.com/fonoster/routr/internal/common/pb/processor"
	spb "github.com/fonoster/routr/internal/common/pb/sipmessage"
)

// numberFormat is how a Trunk wants one kind of number written: the format and
// the prefix that goes before it.
type numberFormat struct {
	format trunks.NumberFormat
	prefix string
}

// numberFormats are a Trunk's called and caller formats, with the country of
// the Number the call leaves from. Nil when the Trunk sets neither format.
type numberFormats struct {
	called numberFormat
	caller numberFormat
	region string
}

// numberFormatsOf are the Trunk's formats for a call that leaves from the
// Number: the egress-policy Number for agent-to-pstn, the X-DOD-Number Number
// for peer-to-pstn.
func numberFormatsOf(trunk *trunks.Trunk, number *numbers.Number) *numberFormats {
	called := numberFormat{format: trunk.GetCalledNumberFormat(), prefix: trunk.GetCalledNumberPrefix()}
	caller := numberFormat{format: trunk.GetCallerNumberFormat(), prefix: trunk.GetCallerNumberPrefix()}
	if called.format == trunks.NumberFormat_UNSPECIFIED && caller.format == trunks.NumberFormat_UNSPECIFIED {
		return nil
	}
	return &numberFormats{called: called, caller: caller, region: numbering.Region(number.GetCountryIsoCode())}
}

// writtenNumber is a user as it goes out, and whether user=phone still
// describes it: only a user that starts with + or was left as it was keeps it.
type writtenNumber struct {
	user      string
	userPhone bool
}

func (f *numberFormats) calledNumber(user string) writtenNumber {
	if f == nil {
		return writtenNumber{user: user, userPhone: true}
	}
	return formatNumber(user, f.called, f.region)
}

func (f *numberFormats) callerNumber(user string) writtenNumber {
	if f == nil {
		return writtenNumber{user: user, userPhone: true}
	}
	return formatNumber(user, f.caller, f.region)
}

// internationalPrefix is the international prefix of the region, digits only,
// as FormatOutOfCountryCallingNumber writes it from there toward a number of
// another country code: 00 from GB, 011 from the US, 0011 from AU. Empty when
// the region is unknown or has none.
func internationalPrefix(region string) string {
	code := phonenumbers.GetCountryCodeForRegion(region)
	if code == 0 {
		return ""
	}
	probe := "+442079460000"
	if code == 44 {
		probe = "+12015550123"
	}
	number, err := phonenumbers.Parse(probe, "ZZ")
	if err != nil {
		return ""
	}
	formatted := phonenumbers.FormatOutOfCountryCallingNumber(number, region)
	tail := strconv.Itoa(int(number.GetCountryCode())) + phonenumbers.GetNationalSignificantNumber(number)
	written := digitsOnly(formatted)
	if strings.HasPrefix(formatted, "+") || !strings.HasSuffix(written, tail) {
		return ""
	}
	return strings.TrimSuffix(written, tail)
}

func digitsOnly(s string) string {
	return strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, s)
}

// formatNumber writes a user the way a Trunk's carrier asks for it, reading it
// with phonenumbers.Parse in the region of the Number the call leaves from:
//
//	E164               +442079460010
//	E164_WITHOUT_PLUS  442079460010
//	NATIONAL           02079460010 for a number of the region; a number of
//	                   another country code in international form
//	INTERNATIONAL      00442079460010: the region's international prefix, the
//	                   country code and the national number
//
// The prefix goes before the digits; # in it is escaped %23 (RFC 3261
// section 25.1). NATIONAL and INTERNATIONAL with a region phonenumbers doesn't
// know write +E.164 with no prefix. A user that doesn't parse, or isn't a
// possible number (911, 112, *67, an Agent's username, anonymous), goes out as
// it is, with no prefix.
func formatNumber(user string, f numberFormat, region string) writtenNumber {
	untouched := writtenNumber{user: user, userPhone: true}
	if user == "" || f.format == trunks.NumberFormat_UNSPECIFIED {
		return untouched
	}
	number, err := phonenumbers.Parse(user, region)
	if err != nil || !phonenumbers.IsPossibleNumber(number) {
		return untouched
	}
	e164 := phonenumbers.Format(number, phonenumbers.E164)
	written := func(user string) writtenNumber {
		return writtenNumber{user: user, userPhone: strings.HasPrefix(user, "+")}
	}
	prefix := strings.ReplaceAll(f.prefix, "#", "%23")
	international := func() writtenNumber {
		idd := internationalPrefix(region)
		if idd == "" {
			return written(e164)
		}
		return written(prefix + idd + strconv.Itoa(int(number.GetCountryCode())) + phonenumbers.GetNationalSignificantNumber(number))
	}
	switch f.format {
	case trunks.NumberFormat_E164:
		return written(e164)
	case trunks.NumberFormat_E164_WITHOUT_PLUS:
		return written(prefix + strings.TrimPrefix(e164, "+"))
	case trunks.NumberFormat_NATIONAL:
		if phonenumbers.GetCountryCodeForRegion(region) != int(number.GetCountryCode()) {
			return international()
		}
		return written(prefix + digitsOnly(phonenumbers.Format(number, phonenumbers.NATIONAL)))
	case trunks.NumberFormat_INTERNATIONAL:
		return international()
	}
	return untouched
}

// formatCalledNumbers writes the To and Request-URI users, each as received,
// in the Trunk's called format. A user written without its + loses
// user=phone.
func formatCalledNumbers(req *ppb.MessageRequest, r *route) {
	if r.formats == nil {
		return
	}
	for _, uri := range []*spb.SipURI{req.GetMessage().GetTo().GetAddress().GetUri(), req.GetMessage().GetRequestUri()} {
		if uri == nil {
			continue
		}
		written := r.formats.calledNumber(uri.GetUser())
		uri.User = written.user
		if !written.userPhone {
			uri.UserParam = ""
		}
	}
}
