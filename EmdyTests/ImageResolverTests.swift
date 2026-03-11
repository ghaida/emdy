import XCTest
@testable import Emdy

final class ImageResolverTests: XCTestCase {

    // MARK: - Local image resolution

    func testLocalImageWithValidPath() throws {
        // Create a temporary image file
        let tempDir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let imageURL = tempDir.appendingPathComponent("test.png")
        let image = createTestImage(width: 100, height: 80)
        let data = image.tiffRepresentation!
        let rep = NSBitmapImageRep(data: data)!
        let pngData = rep.representation(using: .png, properties: [:])!
        try pngData.write(to: imageURL)

        // baseURL is a file in the same directory
        let fakeFileURL = tempDir.appendingPathComponent("doc.md")
        let resolver = ImageResolver(baseURL: fakeFileURL)
        let result = resolver.resolveImage(src: "test.png", altText: "A test image")

        // Should contain an attachment (object replacement character), not placeholder text
        XCTAssertTrue(result.string.contains("\u{FFFC}"), "Local image should render as attachment")
    }

    func testLocalImageMissingFile() {
        let fakeFileURL = FileManager.default.temporaryDirectory.appendingPathComponent("nonexistent/doc.md")
        let resolver = ImageResolver(baseURL: fakeFileURL)
        let result = resolver.resolveImage(src: "missing.png", altText: "Alt text here")

        // Should show failure placeholder with alt text
        XCTAssertTrue(result.string.contains("Alt text here"), "Missing local image should show alt text")
        XCTAssertTrue(result.string.contains("\u{25A1}"), "Missing local image should show failure icon")
    }

    func testLocalImageMissingFileNoAltText() {
        let fakeFileURL = FileManager.default.temporaryDirectory.appendingPathComponent("nonexistent/doc.md")
        let resolver = ImageResolver(baseURL: fakeFileURL)
        let result = resolver.resolveImage(src: "photo.jpg", altText: "")

        // Should fall back to filename
        XCTAssertTrue(result.string.contains("photo.jpg"), "Missing image with no alt text should show filename")
    }

    // MARK: - Remote image placeholders

    func testRemoteURLReturnsPlaceholder() {
        let resolver = ImageResolver(baseURL: nil)
        let result = resolver.resolveImage(src: "https://example.com/hero.png", altText: "Hero image")

        // Should show loading placeholder with alt text
        XCTAssertTrue(result.string.contains("Hero image"), "Remote placeholder should show alt text")
        XCTAssertTrue(result.string.contains("Loading"), "Remote placeholder should indicate loading")
    }

    func testRemoteURLPlaceholderUsesFilenameWhenNoAltText() {
        let resolver = ImageResolver(baseURL: nil)
        let result = resolver.resolveImage(src: "https://example.com/banner.jpg", altText: "")

        XCTAssertTrue(result.string.contains("banner.jpg"), "Remote placeholder should show filename when no alt text")
    }

    func testRemotePlaceholderHasPendingAttribute() {
        let resolver = ImageResolver(baseURL: nil)
        let result = resolver.resolveImage(src: "https://example.com/img.png", altText: "")

        var range = NSRange()
        let attr = result.attribute(ImageResolver.pendingImageURLAttribute, at: 0, effectiveRange: &range) as? String
        XCTAssertEqual(attr, "https://example.com/img.png", "Placeholder should carry the pending URL attribute")
    }

    func testRemotePlaceholderHasAltTextAttribute() {
        let resolver = ImageResolver(baseURL: nil)
        let result = resolver.resolveImage(src: "https://example.com/img.png", altText: "My image")

        let attr = result.attribute(ImageResolver.pendingImageAltAttribute, at: 0, effectiveRange: nil) as? String
        XCTAssertEqual(attr, "My image", "Placeholder should carry the alt text attribute")
    }

    // MARK: - Invalid URLs

    func testInvalidSrcShowsFailure() {
        let resolver = ImageResolver(baseURL: nil)
        let result = resolver.resolveImage(src: "not a valid url %%%", altText: "Broken")

        XCTAssertTrue(result.string.contains("Broken"), "Invalid URL should show alt text in failure state")
        XCTAssertFalse(result.string.contains("Loading"), "Invalid URL should not show loading state")
    }

    // MARK: - Image scaling

    func testImageScaledToMaxWidth() throws {
        let tempDir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let imageURL = tempDir.appendingPathComponent("wide.png")
        let image = createTestImage(width: 1200, height: 600)
        let data = image.tiffRepresentation!
        let rep = NSBitmapImageRep(data: data)!
        try rep.representation(using: .png, properties: [:])!.write(to: imageURL)

        let fakeFileURL = tempDir.appendingPathComponent("doc.md")
        let resolver = ImageResolver(baseURL: fakeFileURL)
        let result = resolver.resolveImage(src: "wide.png", altText: "", maxWidth: 400)

        // Should be an attachment
        XCTAssertTrue(result.string.contains("\u{FFFC}"), "Wide image should still render as attachment")
    }

    // MARK: - Async loading

    func testLoadPendingImagesWithNoPendingImages() {
        let resolver = ImageResolver(baseURL: nil)
        let textStorage = NSTextStorage(string: "No images here")

        let expectation = expectation(description: "completion called")
        resolver.loadPendingImages(in: textStorage) {
            expectation.fulfill()
        }
        waitForExpectations(timeout: 1)
    }

    func testLoadPendingImagesReplacesPlaceholder() {
        let resolver = ImageResolver(baseURL: nil)

        // Build a text storage with a pending image placeholder
        let placeholder = resolver.resolveImage(src: "https://httpbin.org/image/png", altText: "Test")
        let textStorage = NSTextStorage()
        textStorage.append(NSAttributedString(string: "Before "))
        textStorage.append(placeholder)
        textStorage.append(NSAttributedString(string: " After"))

        let originalText = textStorage.string

        let expectation = expectation(description: "images loaded")
        resolver.loadPendingImages(in: textStorage) {
            expectation.fulfill()
        }
        waitForExpectations(timeout: 10)

        // The placeholder text should have been replaced
        XCTAssertNotEqual(textStorage.string, originalText, "Text storage should be modified after loading")
        XCTAssertTrue(textStorage.string.contains("Before"), "Surrounding text should be preserved")
        XCTAssertTrue(textStorage.string.contains("After"), "Surrounding text should be preserved")
    }

    func testLoadPendingImagesFailureShowsAltText() {
        let resolver = ImageResolver(baseURL: nil)

        // Use a URL that will fail
        let placeholder = resolver.resolveImage(src: "https://localhost:1/nonexistent.png", altText: "Fallback text")
        let textStorage = NSTextStorage()
        textStorage.append(placeholder)

        let expectation = expectation(description: "load attempt finished")
        resolver.loadPendingImages(in: textStorage) {
            expectation.fulfill()
        }
        waitForExpectations(timeout: 10)

        XCTAssertTrue(textStorage.string.contains("Fallback text"), "Failed load should show alt text")
        XCTAssertFalse(textStorage.string.contains("Loading"), "Failed load should not show loading state")
    }

    // MARK: - Markdown renderer integration

    func testRendererExtractsAltText() {
        let renderer = MarkdownRenderer(fontFamily: .sansSerif, zoomLevel: 1.0)
        let result = renderer.render("![A descriptive caption](https://example.com/photo.jpg)")

        XCTAssertTrue(result.string.contains("A descriptive caption"), "Renderer should extract and display alt text")
    }

    func testRendererImageWithNoAltText() {
        let renderer = MarkdownRenderer(fontFamily: .sansSerif, zoomLevel: 1.0)
        let result = renderer.render("![](https://example.com/photo.jpg)")

        // Should fall back to filename
        XCTAssertTrue(result.string.contains("photo.jpg"), "Renderer should fall back to filename when no alt text")
    }

    func testRendererLocalMissingImageShowsAlt() {
        let renderer = MarkdownRenderer(fontFamily: .sansSerif, zoomLevel: 1.0)
        let result = renderer.render("![Screenshot of the app](./missing-screenshot.png)")

        XCTAssertTrue(result.string.contains("Screenshot of the app"), "Missing local image should show alt text")
    }

    // MARK: - Helpers

    private func createTestImage(width: Int, height: Int) -> NSImage {
        let image = NSImage(size: NSSize(width: width, height: height))
        image.lockFocus()
        NSColor.red.setFill()
        NSRect(x: 0, y: 0, width: width, height: height).fill()
        image.unlockFocus()
        return image
    }
}
