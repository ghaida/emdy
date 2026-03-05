import SwiftUI

struct SidebarFileList: View {
    @Bindable var directory: DirectoryModel
    @State private var expandedFolders: Set<URL> = []

    var body: some View {
        List(selection: $directory.selectedFile) {
            Section("Files") {
                SidebarNodeRows(nodes: directory.rootNodes, expandedFolders: $expandedFolders)
            }
        }
        .listStyle(.sidebar)
        .listRowSeparator(.hidden)
        .onAppear {
            // Auto-expand top-level folders
            for node in directory.rootNodes where node.isDirectory {
                expandedFolders.insert(node.url)
            }
        }
    }
}

private struct SidebarNodeRows: View {
    let nodes: [FileNode]
    @Binding var expandedFolders: Set<URL>

    var body: some View {
        ForEach(nodes) { node in
            if node.isDirectory, let children = node.children {
                FolderRow(node: node, children: children, expandedFolders: $expandedFolders)
            } else {
                Label {
                    Text(node.name)
                        .font(.system(size: 14))
                        .lineLimit(1)
                        .truncationMode(.middle)
                } icon: {
                    Image(systemName: "doc.text")
                        .font(.system(size: 16))
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)
                .tag(node.url)
            }
        }
    }
}

private struct FolderRow: View {
    let node: FileNode
    let children: [FileNode]
    @Binding var expandedFolders: Set<URL>

    private var isExpanded: Bool {
        expandedFolders.contains(node.url)
    }

    var body: some View {
        Button {
            withAnimation {
                if isExpanded {
                    expandedFolders.remove(node.url)
                } else {
                    expandedFolders.insert(node.url)
                }
            }
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "chevron.right")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .frame(width: 16)
                    .rotationEffect(.degrees(isExpanded ? 90 : 0))
                Image(systemName: "folder")
                    .font(.system(size: 16))
                    .foregroundStyle(.secondary)
                Text(node.name)
                    .font(.system(size: 14, weight: .medium))
                    .lineLimit(1)
                    .truncationMode(.middle)
                Spacer()
            }
            .padding(.vertical, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowBackground(Color.clear)

        if isExpanded {
            SidebarNodeRows(nodes: children, expandedFolders: $expandedFolders)
                .padding(.leading, 16)
        }
    }
}
