const zonedFormatterCache = new Map();

function getZonedFormatter(timezone) {
	let formatter = zonedFormatterCache.get(timezone);

	if (!formatter) {
		formatter = new Intl.DateTimeFormat('en-US-u-ca-gregory', {
			timeZone: timezone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hourCycle: 'h23'
		});
		zonedFormatterCache.set(timezone, formatter);
	}

	return formatter;
}

function getZonedParts(date, timezone) {
	const parts = {};

	for (const part of getZonedFormatter(timezone).formatToParts(date)) {
		if (part.type !== 'literal') {
			parts[part.type] = Number(part.value);
		}
	}

	return {
		year: parts.year,
		month: parts.month,
		day: parts.day,
		hour: parts.hour,
		minute: parts.minute,
		second: parts.second
	};
}

function parseLocalTime(localTime) {
	const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(localTime);
	if (!match) {
		throw new Error(`Invalid recurrenceLocalTime "${localTime}"; expected HH:mm or HH:mm:ss`);
	}

	const hour = Number(match[1]);
	const minute = Number(match[2]);
	const second = Number(match[3] ?? 0);
	if (hour > 23 || minute > 59 || second > 59) {
		throw new Error(`Invalid recurrenceLocalTime "${localTime}"`);
	}

	return { hour, minute, second };
}

function localTimestamp(parts) {
	return Date.UTC(
		parts.year,
		parts.month - 1,
		parts.day,
		parts.hour,
		parts.minute,
		parts.second
	);
}

function sameLocalDate(left, right) {
	return left.year === right.year && left.month === right.month && left.day === right.day;
}

function zonedLocalDateToUtc(local, timezone) {
	const targetTimestamp = localTimestamp(local);
	let guessTimestamp = targetTimestamp;

	// Converge on the applicable UTC offset. Around DST gaps this can oscillate,
	// so the bounded search below resolves ambiguous/nonexistent local times.
	for (let iteration = 0; iteration < 4; iteration += 1) {
		const representedTimestamp = localTimestamp(
			getZonedParts(new Date(guessTimestamp), timezone)
		);
		guessTimestamp += targetTimestamp - representedTimestamp;
	}

	const exactMatches = [];
	const laterCandidates = [];
	for (let minuteOffset = -180; minuteOffset <= 180; minuteOffset += 1) {
		const candidate = new Date(guessTimestamp + minuteOffset * 60_000);
		const candidateLocal = getZonedParts(candidate, timezone);
		const candidateTimestamp = localTimestamp(candidateLocal);

		if (candidateTimestamp === targetTimestamp) {
			exactMatches.push(candidate);
		} else if (sameLocalDate(candidateLocal, local) && candidateTimestamp > targetTimestamp) {
			laterCandidates.push({ candidate, candidateTimestamp });
		}
	}

	if (exactMatches.length > 0) {
		// During a fall-back overlap, use the first occurrence.
		return new Date(Math.min(...exactMatches.map((candidate) => candidate.getTime())));
	}

	if (laterCandidates.length > 0) {
		// During a spring-forward gap, run at the first representable local time
		// after the configured wall-clock time.
		laterCandidates.sort(
			(left, right) =>
				left.candidateTimestamp - right.candidateTimestamp ||
				left.candidate.getTime() - right.candidate.getTime()
		);
		return laterCandidates[0].candidate;
	}

	throw new Error(`Could not resolve monthly auction time in timezone "${timezone}"`);
}

export function getZonedDateTimeUtc({ localDateTime, timezone }) {
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(localDateTime);
	if (!match) {
		throw new Error('Local date and time must use YYYY-MM-DDTHH:mm');
	}
	return zonedLocalDateToUtc({
		year: Number(match[1]),
		month: Number(match[2]),
		day: Number(match[3]),
		hour: Number(match[4]),
		minute: Number(match[5]),
		second: Number(match[6] ?? 0)
	}, timezone);
}

/**
 * Returns a UTC instant for a configured local monthly occurrence.
 * Month is one-based; days beyond the end of a month are clamped.
 */
export function getMonthlyRunAt({ year, month, timezone, dayOfMonth, localTime }) {
	if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
		throw new Error('A valid year and month are required');
	}
	if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
		throw new Error('recurrenceDayOfMonth must be between 1 and 31');
	}

	const { hour, minute, second } = parseLocalTime(localTime);
	const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

	return zonedLocalDateToUtc(
		{
			year,
			month,
			day: Math.min(dayOfMonth, lastDayOfMonth),
			hour,
			minute,
			second
		},
		timezone
	);
}

/**
 * Advances an occurrence by one calendar month using the series' local
 * timezone/day/time configuration instead of adding a fixed duration.
 */
export function getNextMonthlyRunAt({
	after,
	timezone,
	dayOfMonth,
	localTime
}) {
	const date = after instanceof Date ? after : new Date(after);
	if (Number.isNaN(date.getTime())) {
		throw new Error('A valid previous occurrence is required');
	}

	const local = getZonedParts(date, timezone);
	const nextMonth = local.month === 12 ? 1 : local.month + 1;
	const nextYear = local.month === 12 ? local.year + 1 : local.year;

	return getMonthlyRunAt({
		year: nextYear,
		month: nextMonth,
		timezone,
		dayOfMonth,
		localTime
	});
}
