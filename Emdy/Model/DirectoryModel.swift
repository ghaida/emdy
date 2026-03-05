import Foundation

struct FileNode: Identifiable, Hashable {
    let url: URL
    let isDirectory: Bool
    let children: [FileNode]?

    var id: URL { url }
    var name: String { url.lastPathComponent }

    static func == (lhs: FileNode, rhs: FileNode) -> Bool {
        lhs.url == rhs.url
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(url)
    }
}

@Observable
final class DirectoryModel {
    let directoryURL: URL
    private(set) var rootNodes: [FileNode] = []
    var selectedFile: URL?

    private static let markdownExtensions: Set<String> = ["md", "markdown", "mdown", "mkd"]

    init(directoryURL: URL) {
        self.directoryURL = directoryURL
        loadFiles()
    }

    func loadFiles() {
        rootNodes = buildTree(at: directoryURL)

        if selectedFile == nil {
            selectedFile = findFirstFile(in: rootNodes)
        }
    }

    private static let ignoredDirectories: Set<String> = [
        "node_modules", ".git", ".svn", ".hg", "__pycache__", ".DS_Store",
        "build", "dist", ".build", "DerivedData", "Pods", ".swiftpm",
        ".next", ".nuxt", ".output", ".cache", "vendor", ".terraform",
        "target", "out", ".gradle", ".idea", ".vscode",
    ]

    private func buildTree(at url: URL) -> [FileNode] {
        guard let contents = try? FileManager.default.contentsOfDirectory(
            at: url,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else { return [] }

        var files: [FileNode] = []
        var directories: [FileNode] = []

        for item in contents {
            var isDir: ObjCBool = false
            FileManager.default.fileExists(atPath: item.path, isDirectory: &isDir)

            if isDir.boolValue {
                if Self.ignoredDirectories.contains(item.lastPathComponent) { continue }
                let children = buildTree(at: item)
                if !children.isEmpty {
                    directories.append(FileNode(url: item, isDirectory: true, children: children))
                }
            } else if Self.markdownExtensions.contains(item.pathExtension.lowercased()) {
                files.append(FileNode(url: item, isDirectory: false, children: nil))
            }
        }

        let sortedDirs = directories.sorted {
            $0.name.localizedStandardCompare($1.name) == .orderedAscending
        }
        let sortedFiles = files.sorted {
            $0.name.localizedStandardCompare($1.name) == .orderedAscending
        }

        return sortedDirs + sortedFiles
    }

    private func findFirstFile(in nodes: [FileNode]) -> URL? {
        for node in nodes {
            if !node.isDirectory {
                return node.url
            }
            if let children = node.children, let first = findFirstFile(in: children) {
                return first
            }
        }
        return nil
    }
}
