import React, { useEffect, useRef, useState } from 'react';
import { withI18n } from '@lingui/react';
import { t } from '@lingui/macro';
import styled from 'styled-components';
import * as d3 from 'd3';
import {
  calcZoomAndFit,
  constants as wfConstants,
  getZoomTranslate,
} from '@util/workflow';
import {
  WorkflowHelp,
  WorkflowLinkHelp,
  WorkflowNodeHelp,
} from '@components/Workflow';
import {
  VisualizerLink,
  VisualizerNode,
  VisualizerStartNode,
  VisualizerKey,
  VisualizerTools,
} from '@screens/Template/WorkflowJobTemplateVisualizer';

const PotentialLink = styled.polyline`
  pointer-events: none;
`;

const WorkflowSVG = styled.svg`
  display: flex;
  height: 100%;
  background-color: #f6f6f6;
`;

function VisualizerGraph({
  links,
  nodes,
  readOnly,
  nodePositions,
  onDeleteNodeClick,
  onAddNodeClick,
  onEditNodeClick,
  onLinkEditClick,
  onDeleteLinkClick,
  onStartAddLinkClick,
  onConfirmAddLinkClick,
  onCancelAddLinkClick,
  onViewNodeClick,
  addingLink,
  addLinkSourceNode,
  showKey,
  showTools,
  i18n,
}) {
  const [helpText, setHelpText] = useState(null);
  const [nodeHelp, setNodeHelp] = useState();
  const [linkHelp, setLinkHelp] = useState();
  const [zoomPercentage, setZoomPercentage] = useState(100);
  const svgRef = useRef(null);
  const gRef = useRef(null);

  const drawPotentialLinkToNode = node => {
    if (node.id !== addLinkSourceNode.id) {
      const sourceNodeX = nodePositions[addLinkSourceNode.id].x;
      const sourceNodeY =
        nodePositions[addLinkSourceNode.id].y - nodePositions[1].y;
      const targetNodeX = nodePositions[node.id].x;
      const targetNodeY = nodePositions[node.id].y - nodePositions[1].y;
      const startX = sourceNodeX + wfConstants.nodeW;
      const startY = sourceNodeY + wfConstants.nodeH / 2;
      const finishX = targetNodeX;
      const finishY = targetNodeY + wfConstants.nodeH / 2;

      d3.select('#workflow-potentialLink')
        .attr('points', `${startX},${startY} ${finishX},${finishY}`)
        .raise();
    }
  };

  const handleBackgroundClick = () => {
    setHelpText(null);
    onCancelAddLinkClick();
  };

  const drawPotentialLinkToCursor = e => {
    const currentTransform = d3.zoomTransform(d3.select(gRef.current).node());
    const rect = e.target.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const sourceNodeX = nodePositions[addLinkSourceNode.id].x;
    const sourceNodeY =
      nodePositions[addLinkSourceNode.id].y - nodePositions[1].y;
    const startX = sourceNodeX + wfConstants.nodeW;
    const startY = sourceNodeY + wfConstants.nodeH / 2;

    d3.select('#workflow-potentialLink')
      .attr(
        'points',
        `${startX},${startY} ${mouseX / currentTransform.k -
          currentTransform.x / currentTransform.k},${mouseY /
          currentTransform.k -
          currentTransform.y / currentTransform.k}`
      )
      .raise();
  };

  // This is the zoom function called by using the mousewheel/click and drag
  const zoom = () => {
    const translation = [d3.event.transform.x, d3.event.transform.y];
    d3.select(gRef.current).attr(
      'transform',
      `translate(${translation}) scale(${d3.event.transform.k})`
    );

    setZoomPercentage(d3.event.transform.k * 100);
  };

  const handlePan = direction => {
    let { x: xPos, y: yPos, k: currentScale } = d3.zoomTransform(
      d3.select(svgRef.current).node()
    );

    switch (direction) {
      case 'up':
        yPos -= 50;
        break;
      case 'down':
        yPos += 50;
        break;
      case 'left':
        xPos -= 50;
        break;
      case 'right':
        xPos += 50;
        break;
      default:
        // Throw an error?
        break;
    }

    d3.select(svgRef.current).call(
      zoomRef.transform,
      d3.zoomIdentity.translate(xPos, yPos).scale(currentScale)
    );
  };

  const handlePanToMiddle = () => {
    const svgElement = document.getElementById('workflow-svg');
    const svgBoundingClientRect = svgElement.getBoundingClientRect();
    d3.select(svgRef.current).call(
      zoomRef.transform,
      d3.zoomIdentity
        .translate(0, svgBoundingClientRect.height / 2 - 30)
        .scale(1)
    );

    setZoomPercentage(100);
  };

  const handleZoomChange = newScale => {
    const [translateX, translateY] = getZoomTranslate(svgRef.current, newScale);

    d3.select(svgRef.current).call(
      zoomRef.transform,
      d3.zoomIdentity.translate(translateX, translateY).scale(newScale)
    );
    setZoomPercentage(newScale * 100);
  };

  const handleFitGraph = () => {
    const [scaleToFit, yTranslate] = calcZoomAndFit(
      gRef.current,
      svgRef.current
    );

    d3.select(svgRef.current).call(
      zoomRef.transform,
      d3.zoomIdentity.translate(0, yTranslate).scale(scaleToFit)
    );

    setZoomPercentage(scaleToFit * 100);
  };

  const zoomRef = d3
    .zoom()
    .scaleExtent([0.1, 2])
    .on('zoom', zoom);

  // Initialize the zoom
  useEffect(() => {
    d3.select(svgRef.current).call(zoomRef);
  }, [zoomRef]);

  // Attempt to zoom the graph to fit the available screen space
  useEffect(() => {
    const [scaleToFit, yTranslate] = calcZoomAndFit(
      gRef.current,
      svgRef.current
    );

    d3.select(svgRef.current).call(
      zoomRef.transform,
      d3.zoomIdentity.translate(0, yTranslate).scale(scaleToFit)
    );

    setZoomPercentage(scaleToFit * 100);
    // We only want this to run once (when the component mounts)
    // Including zoomRef.transform in the deps array will cause this to
    // run very frequently.
    // Discussion: https://github.com/facebook/create-react-app/issues/6880
    // and https://github.com/facebook/react/issues/15865 amongst others
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {(helpText || nodeHelp || linkHelp) && (
        <WorkflowHelp>
          {helpText && <p>{helpText}</p>}
          {nodeHelp && <WorkflowNodeHelp node={nodeHelp} />}
          {linkHelp && <WorkflowLinkHelp link={linkHelp} />}
        </WorkflowHelp>
      )}
      <WorkflowSVG id="workflow-svg" ref={svgRef} css="">
        <defs>
          <marker
            id="workflow-triangle"
            className="WorkflowChart-noPointerEvents"
            viewBox="0 -5 10 10"
            refX="10"
            markerUnits="strokeWidth"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0,-5L10,0L0,5" fill="#93969A" />
          </marker>
        </defs>
        <rect
          width="100%"
          height="100%"
          opacity="0"
          id="workflow-backround"
          {...(addingLink && {
            onMouseMove: e => drawPotentialLinkToCursor(e),
            onMouseOver: () =>
              setHelpText(
                i18n._(
                  t`Click an available node to create a new link.  Click outside the graph to cancel.`
                )
              ),
            onMouseOut: () => setHelpText(null),
            onClick: () => handleBackgroundClick(),
          })}
        />
        <g id="workflow-g" ref={gRef}>
          {nodePositions && [
            <VisualizerStartNode
              key="start"
              nodePositions={nodePositions}
              readOnly={readOnly}
              updateHelpText={setHelpText}
              addingLink={addingLink}
              onAddNodeClick={onAddNodeClick}
            />,
            links.map(link => {
              if (
                nodePositions[link.source.id] &&
                nodePositions[link.target.id]
              ) {
                return (
                  <VisualizerLink
                    key={`link-${link.source.id}-${link.target.id}`}
                    link={link}
                    nodePositions={nodePositions}
                    updateHelpText={setHelpText}
                    updateLinkHelp={setLinkHelp}
                    readOnly={readOnly}
                    onLinkEditClick={onLinkEditClick}
                    onDeleteLinkClick={onDeleteLinkClick}
                    addingLink={addingLink}
                    onAddNodeClick={onAddNodeClick}
                  />
                );
              }
              return null;
            }),
            nodes.map(node => {
              if (node.id > 1 && nodePositions[node.id] && !node.isDeleted) {
                return (
                  <VisualizerNode
                    key={`node-${node.id}`}
                    node={node}
                    nodePositions={nodePositions}
                    updateHelpText={setHelpText}
                    updateNodeHelp={setNodeHelp}
                    readOnly={readOnly}
                    onAddNodeClick={onAddNodeClick}
                    onEditNodeClick={onEditNodeClick}
                    onDeleteNodeClick={onDeleteNodeClick}
                    onStartAddLinkClick={onStartAddLinkClick}
                    onConfirmAddLinkClick={onConfirmAddLinkClick}
                    onViewNodeClick={onViewNodeClick}
                    addingLink={addingLink}
                    isAddLinkSourceNode={
                      addLinkSourceNode && addLinkSourceNode.id === node.id
                    }
                    {...(addingLink && {
                      onMouseOver: () => drawPotentialLinkToNode(node),
                    })}
                  />
                );
              }
              return null;
            }),
          ]}
          {addingLink && (
            <PotentialLink
              id="workflow-potentialLink"
              strokeDasharray="5,5"
              strokeWidth="2"
              stroke="#93969A"
              markerEnd="url(#workflow-triangle)"
            />
          )}
        </g>
      </WorkflowSVG>
      <div css="position: absolute; top: 75px;right: 20px;display: flex;">
        {showTools && (
          <VisualizerTools
            zoomPercentage={zoomPercentage}
            onZoomChange={handleZoomChange}
            onFitGraph={handleFitGraph}
            onPan={handlePan}
            onPanToMiddle={handlePanToMiddle}
          />
        )}
        {showKey && <VisualizerKey />}
      </div>
    </>
  );
}

export default withI18n()(VisualizerGraph);
