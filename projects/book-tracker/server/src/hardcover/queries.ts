// Field selections here are deliberately conservative -- only fields
// verified against https://github.com/hardcoverapp/hardcover-docs. The API
// is beta and schema fields can shift; if a query starts failing, that repo
// (content/api/GraphQL/Schemas/*.mdx) is the place to re-check field names.

export const SEARCH_BOOKS_QUERY = /* GraphQL */ `
  query SearchBooks($query: String!, $perPage: Int!, $page: Int!) {
    search(query: $query, query_type: "Book", per_page: $perPage, page: $page) {
      ids
    }
  }
`

const BOOK_FIELDS = /* GraphQL */ `
  id
  title
  subtitle
  description
  release_date
  pages
  compilation
  image {
    url
  }
  contributions {
    author {
      id
      name
    }
  }
  editions {
    id
    edition_format
    reading_format_id
    isbn_10
    isbn_13
    asin
    audio_seconds
    release_date
    publisher {
      name
    }
    contributions {
      author {
        name
      }
    }
  }
`

export const BOOKS_BY_IDS_QUERY = /* GraphQL */ `
  query BooksByIds($ids: [Int!]!) {
    books(where: { id: { _in: $ids } }) {
      ${BOOK_FIELDS}
    }
  }
`

export const BOOK_BY_ID_QUERY = /* GraphQL */ `
  query BookById($id: Int!) {
    books_by_pk(id: $id) {
      ${BOOK_FIELDS}
    }
  }
`
