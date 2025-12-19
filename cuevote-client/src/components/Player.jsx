import React from "react";
import PropTypes from "prop-types";

export const Player = React.memo(function Player({ playerContainerRef }) {
  return <div ref={playerContainerRef} className="h-full w-full" />;
});

Player.displayName = "Player";

Player.propTypes = {
  playerContainerRef: PropTypes.object.isRequired,
};
