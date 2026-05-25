// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
import React from 'react';
import PropTypes from 'prop-types';

// Official YouTube play-button brandmark. Permitted by the YouTube Brand
// Guidelines for third-party attribution as long as colour and proportions
// stay intact and a clear space equal to half the brandmark height is
// preserved around it.
// https://www.youtube.com/howyoutubeworks/resources/brand-resources/
export function YouTubeBrandmark({ className }) {
	return (
		<svg
			className={className}
			viewBox="0 0 28 20"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
		>
			<path
				fill="#FF0000"
				d="M27.4 3.1c-.3-1.2-1.3-2.1-2.5-2.4C22.7.2 14 .2 14 .2s-8.7 0-10.9.5C1.9 1 .9 1.9.6 3.1.1 5.3.1 10 .1 10s0 4.7.5 6.9c.3 1.2 1.3 2.1 2.5 2.4 2.2.5 10.9.5 10.9.5s8.7 0 10.9-.5c1.2-.3 2.2-1.2 2.5-2.4.5-2.2.5-6.9.5-6.9s0-4.7-.5-6.9z"
			/>
			<path fill="#FFFFFF" d="M11.2 14.3 18.4 10l-7.2-4.3v8.6z" />
		</svg>
	);
}

YouTubeBrandmark.propTypes = {
	className: PropTypes.string,
};
