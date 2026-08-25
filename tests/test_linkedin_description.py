from job_dashboard.sources import _linkedin_description


class FakePage:
    def goto(self, url, wait_until, timeout):
        self.url = url

    def wait_for_timeout(self, milliseconds):
        pass

    def evaluate(self, script):
        return "Role responsibilities and required experience."


def test_linkedin_detail_description_is_extracted():
    description = _linkedin_description(FakePage(), {"url": "https://www.linkedin.com/jobs/view/123"})
    assert description == "Role responsibilities and required experience."
