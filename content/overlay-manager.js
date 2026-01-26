/**
 * Manages the overlay system on top of map iframes.
 */
export class OverlayManager {
  constructor(mapFrame) {
    this.mapFrame = mapFrame;
    this.overlay = null;
    this.markerData = []; // To store POI data
    this.mapBounds = {
      north: 85.0511,
      south: -85.0511,
      east: 180.0,
      west: -180.0
    };
    this.viewportBounds = null;
  }

  /**
   * Initializes the overlay by creating and positioning it over the map iframe.
   */
  initializeOverlay() {
    if (document.getElementById('poi-overlay')) return;

    this.overlay = document.createElement('div');
    this.overlay.id = 'poi-overlay';
    this.overlay.style.position = 'absolute';
    this.overlay.style.pointerEvents = 'none';
    this.overlay.style.zIndex = '1000';

    this.mapFrame.parentNode.insertBefore(this.overlay, this.mapFrame);
    
    this.updateBoundsAndPosition();

    window.addEventListener('resize', this.handleResize.bind(this));
    this.observeMapChanges();
    
    console.log('Overlay initialized.');
  }

  /**
   * Updates the overlay's position and estimates map/viewport bounds.
   */
  updateBoundsAndPosition() {
    if (!this.overlay || !this.mapFrame) return;

    const iframeRect = this.mapFrame.getBoundingClientRect();
    this.overlay.style.width = iframeRect.width + 'px';
    this.overlay.style.height = iframeRect.height + 'px';
    this.overlay.style.top = (iframeRect.top + window.scrollY) + 'px';
    this.overlay.style.left = (iframeRect.left + window.scrollX) + 'px';

    this.viewportBounds = {
      width: iframeRect.width,
      height: iframeRect.height
    };
  }

  /**
   * Handles window resize events.
   */
  handleResize() {
    this.updateBoundsAndPosition();
    this.renderMarkers();
  }

  /**
   * Observes the map iframe for changes.
   */
  observeMapChanges() {
    const observer = new MutationObserver(() => {
      this.updateBoundsAndPosition();
      this.renderMarkers();
    });
    observer.observe(this.mapFrame, { attributes: true, attributeFilter: ['style', 'src'] });
  }

  /**
   * Renders markers on the overlay.
   */
  renderMarkers() {
    if (!this.overlay) return;
    this.overlay.innerHTML = '';

    this.markerData.forEach(poi => {
      const pos = this.project(poi.latitude, poi.longitude);
      if (this.isWithinViewport(pos)) {
        const markerElement = document.createElement('div');
        markerElement.className = 'poi-marker';
        markerElement.style.position = 'absolute';
        markerElement.style.left = pos.x + 'px';
        markerElement.style.top = pos.y + 'px';
        markerElement.style.width = '12px';
        markerElement.style.height = '12px';
        markerElement.style.backgroundColor = 'red';
        markerElement.style.border = '2px solid white';
        markerElement.style.borderRadius = '50%';
        markerElement.style.pointerEvents = 'auto';
        markerElement.style.cursor = 'pointer';
        markerElement.style.transform = 'translate(-50%, -50%)';
        markerElement.title = poi.name || 'POI';

        markerElement.addEventListener('click', (e) => {
          e.stopPropagation();
          console.log(`Marker clicked: ${poi.name}`);
          alert(`POI: ${poi.name}\nLat: ${poi.latitude}\nLng: ${poi.longitude}`);
        });

        this.overlay.appendChild(markerElement);
      }
    });
    console.log(`Rendered ${this.markerData.length} markers.`);
  }

  /**
   * Projects lat/lng to overlay coordinates.
   */
  project(lat, lng) {
    if (!this.viewportBounds) return { x: 0, y: 0 };
    const x = ((lng - this.mapBounds.west) / (this.mapBounds.east - this.mapBounds.west)) * this.viewportBounds.width;
    const y = ((this.mapBounds.north - lat) / (this.mapBounds.north - this.mapBounds.south)) * this.viewportBounds.height;
    return { x, y };
  }

  /**
   * Checks if a position is within the viewport.
   */
  isWithinViewport(pos) {
    return pos.x >= 0 && pos.x <= this.viewportBounds.width &&
           pos.y >= 0 && pos.y <= this.viewportBounds.height;
  }

  /**
   * Loads POI data and triggers rendering.
   */
  loadPOIs(pois) {
    this.markerData = pois;
    this.renderMarkers();
  }

  /**
   * Clears all markers.
   */
  clearMarkers() {
    this.markerData = [];
    if (this.overlay) this.overlay.innerHTML = '';
  }

  /**
   * Filters markers by group (simplified: just clear or reload for now).
   */
  filterMarkersByGroup(groupName, isVisible) {
    console.log(`Filter markers by group: ${groupName}, visible: ${isVisible}`);
    // This is currently handled by content.js reloading the data for the specific group
  }
}
