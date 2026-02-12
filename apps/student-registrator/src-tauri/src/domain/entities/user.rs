use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfoEntry {
    #[serde(rename = "employeeNo")]
    pub employee_no: String,
    pub name: String,
    pub gender: Option<String>,
    #[serde(rename = "numOfFace")]
    pub num_of_face: Option<i32>,
    #[serde(rename = "faceURL")]
    pub face_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfoSearch {
    #[serde(rename = "UserInfo")]
    pub user_info: Option<Vec<UserInfoEntry>>,
    #[serde(rename = "numOfMatches")]
    pub num_of_matches: Option<i32>,
    #[serde(rename = "totalMatches")]
    pub total_matches: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfoSearchResponse {
    #[serde(rename = "UserInfoSearch")]
    pub user_info_search: Option<UserInfoSearch>,
}
